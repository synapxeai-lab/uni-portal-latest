/**
 * Imports the data of the two legacy apps into the unified database.
 *
 *   sh migration/load-legacy.sh                       (host: copies both legacy DBs in)
 *   docker compose exec server npm run db:import-legacy
 *   docker compose exec server npm run seed           (optional: adds the demo data)
 *
 * Reads the databases legacy_up (University Portal) and legacy_gcr (GCR) on
 * the same server (override with LEGACY_UP_URL / LEGACY_GCR_URL) and writes
 * into DATABASE_URL. Run it on a freshly migrated database: ids are kept as
 * they were (GCR uuids, portal integers), so academic tables must be empty.
 *
 * - GCR: every table copied as-is (same schema), except login sessions,
 *   which were signed with the old app's secret.
 * - University Portal: users become accounts with the same bcrypt password
 *   hash (logins keep working); the admin-viewable copy is re-encrypted with
 *   this app's key when LEGACY_UP_PASSWORD_ENC_KEY (the portal's
 *   PASSWORD_ENC_KEY, or its JWT_SECRET) is given. Teachers and students are
 *   linked to their accounts by email. Every course offering then gets its
 *   classroom, and every registration its fee challan.
 */
import crypto from "node:crypto";

import pg from "pg";

import { syncAllChallans } from "@/features/academics/lib/challans";
import { syncAllOfferingClassrooms } from "@/features/academics/lib/offering-classrooms";
import { encryptPassword } from "@/lib/auth/password-vault";
import { prisma } from "@/lib/prisma";

const base = new URL(process.env.DATABASE_URL!);
const urlFor = (database: string) => {
  const url = new URL(base);
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
};

const target = new pg.Client({ connectionString: urlFor(base.pathname.slice(1)) });
const up = new pg.Client({ connectionString: process.env.LEGACY_UP_URL ?? urlFor("legacy_up") });
const gcr = new pg.Client({ connectionString: process.env.LEGACY_GCR_URL ?? urlFor("legacy_gcr") });

const counts: Record<string, number> = {};
type Row = Record<string, unknown>;

/** Column names and whether each is json, for a target table. */
async function targetColumns(table: string) {
  const { rows } = await target.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Map(rows.map((r) => [r.column_name, r.data_type === "json" || r.data_type === "jsonb"]));
}

/** Inserts rows into a target table (only the columns it has), skipping rows that already exist. */
async function insertRows(table: string, rows: Row[]) {
  if (rows.length === 0) {
    counts[table] = 0;
    return;
  }
  const columns = await targetColumns(table);
  const names = Object.keys(rows[0]).filter((name) => columns.has(name));
  let inserted = 0;
  for (let start = 0; start < rows.length; start += 200) {
    const batch = rows.slice(start, start + 200);
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      const placeholders = names.map((name) => {
        const value = row[name];
        values.push(columns.get(name) && value !== null && typeof value === "object" ? JSON.stringify(value) : value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const result = await target.query(
      `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(", ")}) VALUES ${tuples.join(", ")} ON CONFLICT DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }
  counts[table] = inserted;
}

async function copyTable(source: pg.Client, table: string, transform: (row: Row) => Row = (row) => row) {
  const { rows } = await source.query<Row>(`SELECT * FROM "${table}"`);
  await insertRows(table, rows.map(transform));
}

// ---- Passwords ------------------------------------------------------------------------------

function decryptLegacy(stored: string | null): string | null {
  const secret = process.env.LEGACY_UP_PASSWORD_ENC_KEY;
  if (!stored || !secret) return null;
  try {
    const key = crypto.createHash("sha256").update(secret).digest();
    const [iv, tag, data] = stored.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---- Steps ----------------------------------------------------------------------------------

async function assertEmptyTarget() {
  const { rows } = await target.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM "Department") + (SELECT COUNT(*) FROM "Student") + (SELECT COUNT(*) FROM "Teacher") + (SELECT COUNT(*) FROM "Course") AS n`,
  );
  if (Number(rows[0].n) > 0) {
    throw new Error(
      "The target already has academic records. Import into a freshly migrated database (and seed afterwards), so ids can be kept.",
    );
  }
}

async function importGcr() {
  // Accounts first, then everything that hangs off them and the classrooms.
  await copyTable(gcr, "User");
  await copyTable(gcr, "Room");
  await copyTable(gcr, "SystemSettings");
  for (const table of [
    "LoginAttempt",
    "Account",
    "Classroom",
    "ClassroomSettings",
    "ClassroomMembership",
    "Invitation",
    "Topic",
    "Announcement",
    "Material",
    "Assignment",
    "Submission",
    "Comment",
    "Notification",
    "File",
    "FileAttachment",
    "ActivityLog",
    "TimetableSlot",
    "TimetableClash",
  ]) {
    await copyTable(gcr, table);
  }
}

async function importUpUsers() {
  const { rows } = await up.query<{
    name: string;
    email: string;
    password: string;
    passwordEnc: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }>(`SELECT u.name, u.email, u.password, u."passwordEnc", r.name AS role, u."createdAt", u."updatedAt"
      FROM "User" u JOIN "Role" r ON r.id = u."roleId"`);
  let created = 0;
  let viewable = 0;
  for (const user of rows) {
    const existing = await target.query(`SELECT id FROM "User" WHERE lower(email) = lower($1)`, [user.email]);
    if (existing.rowCount) continue; // same person already came over from GCR
    const plain = decryptLegacy(user.passwordEnc);
    if (plain) viewable += 1;
    await target.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", "passwordEnc", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', false, 0, $7, $8)`,
      [crypto.randomUUID(), user.name, user.email, user.password, plain ? encryptPassword(plain) : null, user.role, user.createdAt, user.updatedAt],
    );
    created += 1;
  }
  counts["User (University Portal)"] = created;
  counts["  with viewable passwords"] = viewable;
}

/** The target user id for an email, if an account exists. */
async function userIdByEmail(): Promise<(email: string) => string | null> {
  const { rows } = await target.query<{ id: string; email: string }>(`SELECT id, email FROM "User"`);
  const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r.id]));
  return (email) => byEmail.get(email.toLowerCase()) ?? null;
}

async function importUpAcademics() {
  const userFor = await userIdByEmail();
  await copyTable(up, "ProgrammeCategory");
  for (const table of ["Department", "Course", "CourseFee", "Batch", "Section"]) {
    await copyTable(up, table);
  }
  await copyTable(up, "Teacher", (row) => ({ ...row, userId: userFor(String(row.email)) }));
  await copyTable(up, "Student", (row) => ({ ...row, userId: userFor(String(row.email)) }));
  await copyTable(up, "_SectionToStudent");
  for (const table of [
    "SectionCourse",
    "PlannedAssignment",
    "Registration",
    "RegistrationLimit",
    "Enrollment",
    "Attendance",
    "CourseAssessment",
    "AssessmentCategory",
    "Assessment",
    "GradingCriteria",
    "Mark",
    "Challan",
  ]) {
    await copyTable(up, table);
  }
}

/** Next ids continue after the imported ones. */
async function resetSequences() {
  const { rows } = await target.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'id' AND column_default LIKE 'nextval%'`,
  );
  for (const { table_name } of rows) {
    await target.query(
      `SELECT setval(pg_get_serial_sequence('"${table_name}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table_name}"), 0) + 1, false)`,
    );
  }
}

async function main() {
  await Promise.all([target.connect(), up.connect(), gcr.connect()]);
  await assertEmptyTarget();
  if (!process.env.LEGACY_UP_PASSWORD_ENC_KEY) {
    console.warn("LEGACY_UP_PASSWORD_ENC_KEY not set: portal passwords still work, but admins can't view them until reset.");
  }
  await importGcr();
  await importUpUsers();
  await importUpAcademics();
  await resetSequences();
  const classrooms = await syncAllOfferingClassrooms();
  counts["Classrooms for course offerings"] = classrooms.length;
  // The portal created challans lazily; create them for every registration now.
  await syncAllChallans();
  counts["Challans"] = await prisma.challan.count();

  console.log("Imported:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(34)} ${count}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([target.end(), up.end(), gcr.end(), prisma.$disconnect()]);
  });
