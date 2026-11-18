/**
 * Removes leftover test logins: student and teacher accounts with no student
 * or teacher record behind them (e.g. "Registration Tester", "Fee Tester").
 * ADMIN accounts are never touched - admins have no record by design.
 *
 *   node dist/remove-orphan-users.js            preview: lists what would go, deletes nothing
 *   node dist/remove-orphan-users.js --confirm  deletes them
 *   (locally: npx tsx scripts/remove-orphan-users.ts [--confirm])
 *
 * Each account is deleted the same way as "Delete user" on the Users page
 * (src/lib/delete-account.ts), with the first active admin taking over a course
 * section's classroom it owns and a teacher's material in it. Each account is
 * removed in its own transaction: if one fails, it is reported and the rest
 * carry on.
 */
import { deleteAccount } from "@/lib/delete-account";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@/generated/prisma/enums";

const confirm = process.argv.includes("--confirm");

const orphans = await prisma.user.findMany({
  where: {
    role: { in: [UserRole.STUDENT, UserRole.TEACHER] },
    studentProfile: null,
    teacherProfile: null,
  },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    status: true,
    _count: {
      select: {
        ownedClassrooms: true,
      },
    },
  },
  orderBy: [{ role: "asc" }, { name: "asc" }],
});

// An admin to take over any course-section classroom an orphan still owns.
const fallbackAdmin = await prisma.user.findFirst({
  where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  orderBy: { createdAt: "asc" },
  select: { id: true, email: true },
});

if (orphans.length === 0) {
  console.log("No student or teacher accounts without a record. Nothing to do.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`${orphans.length} account(s) with no student or teacher record (admins excluded):\n`);
for (const user of orphans) {
  const owned = user._count.ownedClassrooms;
  console.log(
    `  ${user.role.padEnd(7)} ${user.name} <${user.email}> [${user.status}]` +
      (owned ? ` - owns ${owned} classroom(s)` : ""),
  );
}

if (!confirm) {
  console.log("\nPreview only - nothing was deleted. Run again with --confirm to delete these accounts.");
  await prisma.$disconnect();
  process.exit(0);
}

let removed = 0;
const failed: string[] = [];

for (const user of orphans) {
  try {
    await deleteAccount(user.id, fallbackAdmin?.id ?? null);
    removed += 1;
    console.log(`  removed: ${user.name} <${user.email}>`);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n").pop() : String(error);
    failed.push(`${user.name} <${user.email}>: ${reason}`);
    console.log(`  FAILED:  ${user.name} <${user.email}> - ${reason}`);
  }
}

console.log(`\n${removed} removed, ${failed.length} failed.`);
if (failed.length) {
  console.log("Failed accounts were left untouched (their transaction was rolled back).");
}
await prisma.$disconnect();
