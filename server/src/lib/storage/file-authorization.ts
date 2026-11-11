import type { SessionUser } from "@/auth/session";
import {
  assertMembership,
  hasManagementAccess,
} from "@/features/classroom/services/classroom-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  AnnouncementStatus,
  AssignmentStatus,
  ClassroomStatus,
  FileAttachmentType,
  MaterialStatus,
  SubmissionStatus,
  UserRole,
} from "@/generated/prisma/enums";

// Every branch below throws the same generic "File not found" rather than
// distinguishing "doesn't exist" from "you can't see it" - the same
// don't-leak-existence convention used by getClassroomForUser and friends
// throughout the app.
const NOT_FOUND = new ClassroomServiceError("NOT_FOUND", "File not found.");

async function assertClassroomVisible(classroomId: string): Promise<void> {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { status: true },
  });
  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw NOT_FOUND;
  }
}

/**
 * assertMembership throws its own specific "You are not a member of this
 * classroom" FORBIDDEN error - correct for most callers, but here it would
 * leak exactly the "doesn't exist vs. can't see it" distinction this module
 * otherwise deliberately collapses into one generic 404. Normalizes it.
 */
async function assertVisibleMember(classroomId: string, user: SessionUser): Promise<void> {
  try {
    await assertMembership(classroomId, user);
  } catch {
    throw NOT_FOUND;
  }
}

async function assertCanAccessAnnouncementFile(entityId: string, user: SessionUser): Promise<void> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: entityId },
    select: { classroomId: true, status: true, deletedAt: true },
  });
  if (!announcement || announcement.deletedAt) throw NOT_FOUND;
  await assertClassroomVisible(announcement.classroomId);

  const canManage = await hasManagementAccess(announcement.classroomId, user);
  if (!canManage && announcement.status !== AnnouncementStatus.PUBLISHED) {
    throw NOT_FOUND;
  }
  await assertVisibleMember(announcement.classroomId, user);
}

async function assertCanAccessMaterialFile(entityId: string, user: SessionUser): Promise<void> {
  const material = await prisma.material.findUnique({
    where: { id: entityId },
    select: { classroomId: true, status: true, deletedAt: true },
  });
  if (!material || material.deletedAt) throw NOT_FOUND;
  await assertClassroomVisible(material.classroomId);

  const canManage = await hasManagementAccess(material.classroomId, user);
  if (!canManage && material.status !== MaterialStatus.PUBLISHED) {
    throw NOT_FOUND;
  }
  await assertVisibleMember(material.classroomId, user);
}

const ASSIGNMENT_MEMBER_VISIBLE_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PUBLISHED,
  AssignmentStatus.CLOSED,
];

async function assertCanAccessAssignmentFile(entityId: string, user: SessionUser): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: entityId },
    select: { classroomId: true, status: true, deletedAt: true },
  });
  if (!assignment || assignment.deletedAt) throw NOT_FOUND;
  await assertClassroomVisible(assignment.classroomId);

  const canManage = await hasManagementAccess(assignment.classroomId, user);
  if (!canManage && !ASSIGNMENT_MEMBER_VISIBLE_STATUSES.includes(assignment.status)) {
    throw NOT_FOUND;
  }
  await assertVisibleMember(assignment.classroomId, user);
}

async function assertCanAccessSubmissionFile(entityId: string, user: SessionUser): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: entityId },
    select: {
      studentId: true,
      status: true,
      deletedAt: true,
      assignment: { select: { classroomId: true } },
    },
  });
  if (!submission || submission.deletedAt) throw NOT_FOUND;

  const classroomId = submission.assignment.classroomId;
  await assertClassroomVisible(classroomId);

  if (submission.studentId === user.id) {
    return; // the owning student can always see their own attachment
  }

  const canManage = await hasManagementAccess(classroomId, user);
  // A draft (ASSIGNED, never turned in) submission is invisible to a teacher
  // everywhere else in the app - mirror that rule here too.
  if (!canManage || submission.status === SubmissionStatus.ASSIGNED) {
    throw NOT_FOUND;
  }
}

/**
 * The authorization dispatch every file-serving request goes through -
 * reuses each domain's own existing visibility rules (published-only for
 * plain members, draft-submission-hidden-from-teachers, ...) rather than
 * inventing a new, parallel set of file-specific permissions.
 */
export async function assertCanAccessFileAttachment(
  user: SessionUser,
  attachment: { attachmentType: FileAttachmentType; entityId: string },
): Promise<void> {
  if (user.role === UserRole.ADMIN) {
    return; // platform-wide admin bypass, same convention used everywhere else
  }

  switch (attachment.attachmentType) {
    case FileAttachmentType.ANNOUNCEMENT:
      return assertCanAccessAnnouncementFile(attachment.entityId, user);
    case FileAttachmentType.MATERIAL:
      return assertCanAccessMaterialFile(attachment.entityId, user);
    case FileAttachmentType.ASSIGNMENT:
      return assertCanAccessAssignmentFile(attachment.entityId, user);
    case FileAttachmentType.SUBMISSION:
      return assertCanAccessSubmissionFile(attachment.entityId, user);
  }
}
