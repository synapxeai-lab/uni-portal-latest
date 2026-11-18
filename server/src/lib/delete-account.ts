import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ClassroomMembershipRole, ClassroomMembershipStatus, UserRole } from "@/generated/prisma/enums";

/**
 * Permanently deletes a login and what hangs off it. `heirId` (an admin) takes
 * over whatever must outlive the account:
 *
 * - a course section's classroom it owns is handed to the heir; a classroom it
 *   made by hand is deleted with everything inside;
 * - a teacher's or admin's posts, materials, assignments and files in classrooms
 *   that stay are handed to the heir, so students keep their coursework;
 *   a student's own posts, submissions and files are deleted;
 * - comments, timetable slots/requests, invitations, memberships and audit-log
 *   entries made by the account are deleted.
 *
 * Sessions and notifications go with the user (cascade); login history keeps
 * its rows. A student or teacher record linked to the login is NOT touched
 * here (its link is cleared) - the people service deletes records.
 * Uploaded files' database rows are removed; their bytes stay in storage.
 *
 * Returns the ids of classrooms that changed, for cache invalidation.
 */
export async function deleteAccountTx(
  tx: Prisma.TransactionClient,
  userId: string,
  heirId: string | null,
): Promise<string[]> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) {
    return [];
  }
  if (heirId === userId) {
    heirId = null;
  }

  const touched = new Set<string>();
  const owned = await tx.classroom.findMany({
    where: { ownerId: userId },
    select: { id: true, sectionCourseId: true, offeringKey: true },
  });

  for (const classroom of owned) {
    touched.add(classroom.id);
    const isSectionClassroom = classroom.sectionCourseId !== null || classroom.offeringKey !== null;
    if (!isSectionClassroom) {
      await tx.classroom.delete({ where: { id: classroom.id } });
      continue;
    }
    if (!heirId) {
      throw new Error("owns a course section's classroom and there is no admin to hand it to");
    }
    await tx.classroom.update({ where: { id: classroom.id }, data: { ownerId: heirId } });
    await tx.classroomMembership.upsert({
      where: { classroomId_userId: { classroomId: classroom.id, userId: heirId } },
      update: { role: ClassroomMembershipRole.OWNER, status: ClassroomMembershipStatus.ACTIVE },
      create: {
        classroomId: classroom.id,
        userId: heirId,
        role: ClassroomMembershipRole.OWNER,
        status: ClassroomMembershipStatus.ACTIVE,
      },
    });
  }

  const mine = { where: { authorId: userId } };
  const keepsWork = user.role !== UserRole.STUDENT && heirId !== null;

  for (const m of await tx.classroomMembership.findMany({ where: { userId }, select: { classroomId: true } })) {
    touched.add(m.classroomId);
  }

  await tx.comment.deleteMany(mine);
  await tx.submission.deleteMany({ where: { studentId: userId } });
  if (keepsWork) {
    const toHeir = { data: { authorId: heirId! }, ...mine };
    await tx.announcement.updateMany(toHeir);
    await tx.material.updateMany(toHeir);
    await tx.assignment.updateMany(toHeir);
    await tx.file.updateMany({ where: { uploadedById: userId }, data: { uploadedById: heirId! } });
  } else {
    await tx.assignment.deleteMany(mine);
    await tx.announcement.deleteMany(mine);
    await tx.material.deleteMany(mine);
    await tx.file.deleteMany({ where: { uploadedById: userId } });
  }
  await tx.timetableClash.deleteMany({ where: { requestedById: userId } });
  await tx.timetableSlot.deleteMany({ where: { teacherId: userId } });
  await tx.invitation.deleteMany({ where: { invitedById: userId } });
  await tx.classroomMembership.deleteMany({ where: { userId } });
  await tx.activityLog.deleteMany({ where: { actorId: userId } });
  await tx.user.delete({ where: { id: userId } });

  return [...touched];
}

/** A heavy account can take a while; give the transaction room. */
export const DELETE_ACCOUNT_TX = { timeout: 60_000, maxWait: 10_000 } as const;

/** deleteAccountTx in its own transaction. */
export function deleteAccount(userId: string, heirId: string | null): Promise<string[]> {
  return prisma.$transaction((tx) => deleteAccountTx(tx, userId, heirId), DELETE_ACCOUNT_TX);
}
