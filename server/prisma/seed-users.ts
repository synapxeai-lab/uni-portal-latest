/**
 * Sign-in accounts only: the admin, teachers and students, with known
 * passwords. No programmes, offerings, registrations or marks (npm run seed
 * adds those).
 *
 *   docker compose exec server npm run seed:users
 *   docker compose exec server npm run seed:users -- --reset-passwords
 *
 * Creates any account that's missing. An existing account keeps its password
 * unless --reset-passwords is passed, which sets it back to the one listed
 * here (and clears "must change password"). Each login is linked to the
 * teacher or student profile with the same email, if that profile has none.
 */
import { passwordFields } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@/generated/prisma/client";

import { SEED_ACCOUNTS, type SeedAccount } from "./seed/accounts";
import { FUTURE_STUDENT, seedFutureStudent } from "./seed/future-student";

/** Accounts added while testing the portal, given the same demo passwords. */
const TEST_ACCOUNTS: SeedAccount[] = [
  { key: "usman", name: "Capt. Usman Tariq", email: "usman.tariq@eithm.edu.pk", password: "Teacher@123", role: UserRole.TEACHER },
  { key: "fatima", name: "Ms. Fatima Noor", email: "fatima.noor@eithm.edu.pk", password: "Teacher@123", role: UserRole.TEACHER },
  { key: "ahmed", name: "Ahmed Siddiqui", email: "ahmed.siddiqui@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "ayesha-malik", name: "Ayesha Malik", email: "ayesha.malik@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  // The 2027 intake (not started yet): Registration says "Your batch has not started yet".
  { key: "areeba", name: FUTURE_STUDENT.name, email: FUTURE_STUDENT.email, password: FUTURE_STUDENT.password, role: UserRole.STUDENT },
];

const ACCOUNTS = [...SEED_ACCOUNTS, ...TEST_ACCOUNTS];

/** Links the login to the teacher/student profile with its email, if that profile has no login yet. */
async function linkProfile(account: SeedAccount, userId: string) {
  const where = { email: account.email };
  if (account.role === UserRole.TEACHER) {
    const profile = await prisma.teacher.findUnique({ where, select: { userId: true } });
    if (!profile) return "no teacher profile";
    if (!profile.userId) await prisma.teacher.update({ where, data: { userId } });
    return profile.userId && profile.userId !== userId ? "profile has another login" : "teacher profile";
  }
  if (account.role === UserRole.STUDENT) {
    const profile = await prisma.student.findUnique({ where, select: { userId: true } });
    if (!profile) return "no student profile";
    if (!profile.userId) await prisma.student.update({ where, data: { userId } });
    return profile.userId && profile.userId !== userId ? "profile has another login" : "student profile";
  }
  return "";
}

async function main() {
  const reset = process.argv.includes("--reset-passwords");
  // Her record (and the 2027 batch, if missing) first, so her login links to it below.
  await seedFutureStudent(prisma);
  const rows: Record<string, string>[] = [];

  for (const account of ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    let user = existing;
    let action: string;
    if (!existing) {
      user = await prisma.user.create({
        data: {
          name: account.name,
          email: account.email,
          role: account.role,
          status: UserStatus.ACTIVE,
          ...(await passwordFields(account.password)),
        },
      });
      action = "created";
    } else if (reset) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { ...(await passwordFields(account.password)), mustChangePassword: false, status: UserStatus.ACTIVE },
      });
      action = "password reset";
    } else {
      action = "kept (own password)";
    }
    if (existing && existing.role !== account.role) action += `, is ${existing.role}`;

    rows.push({
      role: account.role,
      email: account.email,
      password: account.password,
      account: action,
      profile: await linkProfile(account, user!.id),
    });
  }

  console.table(rows);
  if (!reset && rows.some((r) => r.account.startsWith("kept"))) {
    console.log("Accounts marked \"kept\" still have their own password. Re-run with -- --reset-passwords to set them to the passwords listed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
