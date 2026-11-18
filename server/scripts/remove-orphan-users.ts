/**
 * Removes leftover test logins: student and teacher accounts with no student
 * or teacher record behind them (e.g. "Registration Tester", "Fee Tester").
 * ADMIN accounts are never touched - admins have no record by design.
 *
 *   node dist/remove-orphan-users.js            preview: lists what would go, deletes nothing
 *   node dist/remove-orphan-users.js --confirm  deletes them
 *   (locally: npx tsx scripts/remove-orphan-users.ts [--confirm])
 *
 * For each account, what it made goes with it: classrooms it created by hand
 * (with everything inside), and its posts, classwork, comments, submissions,
 * files, timetable slots/requests, memberships and audit-log entries.
 * A course section's classroom it still owns is NOT deleted - it is handed to
 * an admin, so the section keeps its classroom. Each account is removed in its
 * own transaction: if one fails, it is reported and the rest carry on.
 * Uploaded files' database rows are removed; their bytes stay in storage.
 */
import { prisma } from "@/lib/prisma";
import { ClassroomMembershipRole, ClassroomMembershipStatus, UserRole, UserStatus } from "@/generated/prisma/enums";

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
    await prisma.$transaction(async (tx) => {
      const owned = await tx.classroom.findMany({
        where: { ownerId: user.id },
        select: { id: true, sectionCourseId: true, offeringKey: true },
      });

      for (const classroom of owned) {
        const isSectionClassroom = classroom.sectionCourseId !== null || classroom.offeringKey !== null;
        if (isSectionClassroom) {
          if (!fallbackAdmin) {
            throw new Error("owns a course section's classroom and there is no active admin to hand it to");
          }
          await tx.classroom.update({ where: { id: classroom.id }, data: { ownerId: fallbackAdmin.id } });
          await tx.classroomMembership.upsert({
            where: { classroomId_userId: { classroomId: classroom.id, userId: fallbackAdmin.id } },
            update: { role: ClassroomMembershipRole.OWNER, status: ClassroomMembershipStatus.ACTIVE },
            create: {
              classroomId: classroom.id,
              userId: fallbackAdmin.id,
              role: ClassroomMembershipRole.OWNER,
              status: ClassroomMembershipStatus.ACTIVE,
            },
          });
        } else {
          // A hand-made test class: everything inside goes with it.
          await tx.classroom.delete({ where: { id: classroom.id } });
        }
      }

      const mine = { where: { authorId: user.id } };
      await tx.comment.deleteMany(mine);
      await tx.submission.deleteMany({ where: { studentId: user.id } });
      await tx.assignment.deleteMany(mine);
      await tx.announcement.deleteMany(mine);
      await tx.material.deleteMany(mine);
      await tx.timetableClash.deleteMany({ where: { requestedById: user.id } });
      await tx.timetableSlot.deleteMany({ where: { teacherId: user.id } });
      await tx.invitation.deleteMany({ where: { invitedById: user.id } });
      await tx.file.deleteMany({ where: { uploadedById: user.id } });
      await tx.classroomMembership.deleteMany({ where: { userId: user.id } });
      await tx.activityLog.deleteMany({ where: { actorId: user.id } });
      // Sessions and notifications go with the user; login history keeps its rows.
      await tx.user.delete({ where: { id: user.id } });
    });
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
