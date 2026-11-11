import type { SessionUser } from "@/auth/session";
import {
  assertClassroomActive,
  assertManagementAccess,
  hasManagementAccess,
  loadActiveClassroom,
} from "@/features/classroom/services/classroom-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import { notifyAssignmentPublished } from "@/features/notifications/services/notification-generator";
import { recordAuditEvent } from "@/lib/audit-log";
import { getFileAttachmentsByEntityIds, type AttachedFileSummary } from "@/lib/file-attachments";
import { prisma } from "@/lib/prisma";
import { deleteAttachment, uploadAttachments } from "@/lib/storage/file-service";
import type { Prisma } from "@/generated/prisma/client";
import {
  ActivityAction,
  AssignmentStatus,
  ClassroomStatus,
  FileAttachmentType,
  SubmissionStatus,
} from "@/generated/prisma/enums";
import type { ScheduleAdapter, SchedulableRecord } from "@/lib/scheduling/types";

import { assertTopicBelongsToClassroom } from "./topic-service";
import type { AssignmentSummary } from "../types";

export interface AssignmentInput {
  title: string;
  description?: string;
  dueDate?: string;
  points?: string;
  allowLateSubmission: boolean;
  topicId?: string;
}

function assignmentWithAuthorInclude() {
  return { author: { select: { name: true } } } as const;
}

type AssignmentWithAuthor = Prisma.AssignmentGetPayload<{
  include: ReturnType<typeof assignmentWithAuthorInclude>;
}>;

function toAssignmentSummary(
  assignment: AssignmentWithAuthor,
  attachments: AttachedFileSummary[],
  canManage: boolean,
): AssignmentSummary {
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    status: assignment.status,
    scheduledFor: assignment.scheduledFor,
    dueDate: assignment.dueDate,
    points: assignment.points,
    allowLateSubmission: assignment.allowLateSubmission,
    topicId: assignment.topicId,
    authorName: assignment.author.name,
    createdAt: assignment.createdAt,
    attachments,
    canManage,
  };
}

async function findActiveAssignmentOrThrow(assignmentId: string) {
  // Includes the classroom title so publishAssignment doesn't need a second
  // round trip just to build its notification message - the other three
  // callers (update/close/delete) simply don't touch the extra field.
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { classroom: { select: { title: true, status: true } } },
  });

  if (!assignment || assignment.deletedAt) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  return assignment;
}

export async function getAssignmentForUser(
  classroomId: string,
  assignmentId: string,
  viewer: SessionUser,
): Promise<AssignmentSummary> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: assignmentWithAuthorInclude(),
  });

  if (!assignment || assignment.deletedAt || assignment.classroomId !== classroomId) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  const canManage = await hasManagementAccess(assignment.classroomId, viewer);

  // Drafts and scheduled assignments don't exist yet as far as students are
  // concerned - hide, don't forbid.
  if (
    !canManage &&
    (assignment.status === AssignmentStatus.DRAFT ||
      assignment.status === AssignmentStatus.SCHEDULED)
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  const attachmentsByAssignmentId = await getFileAttachmentsByEntityIds(
    [assignment.id],
    FileAttachmentType.ASSIGNMENT,
  );

  return toAssignmentSummary(
    assignment,
    attachmentsByAssignmentId.get(assignment.id) ?? [],
    canManage,
  );
}

export async function listClassroomAssignments(
  classroomId: string,
  viewer: SessionUser,
): Promise<AssignmentSummary[]> {
  const canManage = await hasManagementAccess(classroomId, viewer);

  const assignments = await prisma.assignment.findMany({
    where: {
      classroomId,
      deletedAt: null,
      // Drafts are only visible to whoever can manage this classroom - students
      // never see an assignment before it's published, matching Google Classroom.
      ...(canManage
        ? {}
        : { status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] } }),
    },
    include: assignmentWithAuthorInclude(),
    orderBy: { createdAt: "desc" },
  });

  if (assignments.length === 0) {
    return [];
  }

  const attachmentsByAssignmentId = await getFileAttachmentsByEntityIds(
    assignments.map((assignment) => assignment.id),
    FileAttachmentType.ASSIGNMENT,
  );

  return assignments.map((assignment) =>
    toAssignmentSummary(assignment, attachmentsByAssignmentId.get(assignment.id) ?? [], canManage),
  );
}

/**
 * The soonest-due Published assignments across the given classrooms - backs
 * the Student dashboard's "Upcoming Deadlines" list. Only ever queries
 * PUBLISHED assignments (never DRAFT/SCHEDULED), so it can't leak content a
 * student isn't meant to see yet - the same visibility rule already enforced
 * everywhere else, just expressed directly in this query's WHERE clause
 * rather than filtered after the fact.
 */
export async function getUpcomingDeadlines(
  classroomIds: string[],
  limit = 5,
): Promise<
  { id: string; title: string; classroomId: string; classroomTitle: string; dueDate: Date }[]
> {
  if (classroomIds.length === 0) {
    return [];
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      classroomId: { in: classroomIds },
      deletedAt: null,
      status: AssignmentStatus.PUBLISHED,
      dueDate: { gte: new Date() },
    },
    select: {
      id: true,
      title: true,
      classroomId: true,
      dueDate: true,
      classroom: { select: { title: true } },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    classroomId: assignment.classroomId,
    classroomTitle: assignment.classroom.title,
    dueDate: assignment.dueDate as Date,
  }));
}

export async function createAssignment(
  classroomId: string,
  user: SessionUser,
  input: AssignmentInput,
  status:
    | typeof AssignmentStatus.DRAFT
    | typeof AssignmentStatus.SCHEDULED
    | typeof AssignmentStatus.PUBLISHED,
  files: File[],
  scheduledFor: Date | null = null,
): Promise<AssignmentSummary> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  assertClassroomActive(classroom, "This class is archived and can't accept new assignments.");

  await assertManagementAccess(classroomId, user);

  if (input.topicId) {
    await assertTopicBelongsToClassroom(input.topicId, classroomId);
  }

  const created = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        classroomId,
        topicId: input.topicId ?? null,
        authorId: user.id,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        points: input.points ? Number(input.points) : null,
        allowLateSubmission: input.allowLateSubmission,
        status,
        scheduledFor: status === AssignmentStatus.SCHEDULED ? scheduledFor : null,
        publishedAt: status === AssignmentStatus.PUBLISHED ? new Date() : null,
        publishedById: status === AssignmentStatus.PUBLISHED ? user.id : null,
      },
      include: assignmentWithAuthorInclude(),
    });

    await uploadAttachments({
      files,
      attachmentType: FileAttachmentType.ASSIGNMENT,
      entityId: assignment.id,
      uploadedById: user.id,
      tx,
    });

    return assignment;
  });

  if (status === AssignmentStatus.PUBLISHED) {
    await notifyAssignmentPublished({
      classroomId,
      classroomTitle: classroom.title,
      authorId: user.id,
      assignmentId: created.id,
      assignmentTitle: created.title,
    });
  }

  const attachmentsByAssignmentId = await getFileAttachmentsByEntityIds(
    [created.id],
    FileAttachmentType.ASSIGNMENT,
  );
  return toAssignmentSummary(created, attachmentsByAssignmentId.get(created.id) ?? [], true);
}

export async function updateAssignment(
  assignmentId: string,
  user: SessionUser,
  input: AssignmentInput,
  files: File[] = [],
): Promise<AssignmentSummary> {
  const existing = await findActiveAssignmentOrThrow(assignmentId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  if (input.topicId) {
    await assertTopicBelongsToClassroom(input.topicId, existing.classroomId);
  }

  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  const dueDateChanged = dueDate?.getTime() !== existing.dueDate?.getTime();

  // An untouched due date may already be in the past - only a newly picked
  // one has to be in the future (and after a pending scheduled publish).
  if (dueDate && dueDateChanged) {
    if (dueDate <= new Date()) {
      throw new ClassroomServiceError("VALIDATION_ERROR", "Due date must be in the future.");
    }
    if (
      existing.status === AssignmentStatus.SCHEDULED &&
      existing.scheduledFor &&
      dueDate <= existing.scheduledFor
    ) {
      throw new ClassroomServiceError(
        "VALIDATION_ERROR",
        "Due date must be after the scheduled publish time.",
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        title: input.title,
        description: input.description ?? null,
        dueDate,
        points: input.points ? Number(input.points) : null,
        allowLateSubmission: input.allowLateSubmission,
        topic: input.topicId ? { connect: { id: input.topicId } } : { disconnect: true },
      },
      include: assignmentWithAuthorInclude(),
    });

    if (dueDateChanged) {
      await reclassifyTurnedInWork(tx, assignmentId, dueDate);
    }

    return record;
  });

  // Editing only ever adds new attachments here - removing an existing one is
  // its own explicit action (removeAssignmentAttachment).
  await uploadAttachments({
    files,
    attachmentType: FileAttachmentType.ASSIGNMENT,
    entityId: assignmentId,
    uploadedById: user.id,
  });

  const attachmentsByAssignmentId = await getFileAttachmentsByEntityIds(
    [assignmentId],
    FileAttachmentType.ASSIGNMENT,
  );
  return toAssignmentSummary(updated, attachmentsByAssignmentId.get(assignmentId) ?? [], true);
}

/**
 * Moving the due date re-decides which turned-in work counts as late, so the
 * stored SUBMITTED/LATE status always agrees with submittedAt vs. dueDate.
 * Graded/returned rows keep their status - their late flag is derived from
 * the timestamps wherever it's displayed.
 */
async function reclassifyTurnedInWork(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  dueDate: Date | null,
): Promise<void> {
  if (dueDate) {
    await tx.submission.updateMany({
      where: { assignmentId, status: SubmissionStatus.SUBMITTED, submittedAt: { gt: dueDate } },
      data: { status: SubmissionStatus.LATE },
    });
  }
  await tx.submission.updateMany({
    where: {
      assignmentId,
      status: SubmissionStatus.LATE,
      ...(dueDate ? { submittedAt: { lte: dueDate } } : {}),
    },
    data: { status: SubmissionStatus.SUBMITTED },
  });
}

export async function removeAssignmentAttachment(
  assignmentId: string,
  fileAttachmentId: string,
  user: SessionUser,
): Promise<void> {
  const existing = await findActiveAssignmentOrThrow(assignmentId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  const attachment = await prisma.fileAttachment.findUnique({ where: { id: fileAttachmentId } });
  if (
    !attachment ||
    attachment.attachmentType !== FileAttachmentType.ASSIGNMENT ||
    attachment.entityId !== assignmentId
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Attachment not found.");
  }

  await deleteAttachment(fileAttachmentId);
}

// Publishing a draft/scheduled assignment immediately now goes through the
// shared scheduling engine's publishNow() + assignmentScheduleAdapter below,
// rather than a dedicated function here - see src/features/scheduling.

export async function closeAssignment(assignmentId: string, user: SessionUser): Promise<void> {
  const existing = await findActiveAssignmentOrThrow(assignmentId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its assignments can't be closed.",
  );
  await assertManagementAccess(existing.classroomId, user);

  if (existing.status !== AssignmentStatus.PUBLISHED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "Only published assignments can be closed.",
    );
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: AssignmentStatus.CLOSED },
  });
}

export async function deleteAssignment(assignmentId: string, user: SessionUser): Promise<void> {
  const existing = await findActiveAssignmentOrThrow(assignmentId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be deleted.",
  );
  await assertManagementAccess(existing.classroomId, user);

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { deletedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: user.id,
    action: ActivityAction.DELETED,
    entityType: "Assignment",
    entityId: assignmentId,
    targetLabel: existing.title,
    classroomId: existing.classroomId,
  });
}

interface SchedulableAssignment extends SchedulableRecord {
  title: string;
}

function toSchedulableAssignment(assignment: {
  id: string;
  classroomId: string;
  status: AssignmentStatus;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  title: string;
}): SchedulableAssignment {
  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    status: assignment.status,
    scheduledFor: assignment.scheduledFor,
    publishedAt: assignment.publishedAt,
    title: assignment.title,
  };
}

/** Bridges Assignment to the shared scheduling engine - see stream-service.ts's adapter for the counterpart. */
export const assignmentScheduleAdapter: ScheduleAdapter<SchedulableAssignment> = {
  contentType: "assignment",

  async findById(id) {
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.deletedAt) {
      return null;
    }
    return toSchedulableAssignment(assignment);
  },

  async findDueForPublishing(now) {
    const assignments = await prisma.assignment.findMany({
      where: {
        status: AssignmentStatus.SCHEDULED,
        scheduledFor: { lte: now },
        deletedAt: null,
      },
    });
    return assignments.map(toSchedulableAssignment);
  },

  async assertSchedulable(record) {
    // Closed assignments can never be (re-)scheduled - they're a terminal state.
    if (record.status === AssignmentStatus.CLOSED) {
      throw new ClassroomServiceError(
        "VALIDATION_ERROR",
        "Closed assignments can't be scheduled or published.",
      );
    }

    const classroom = await loadActiveClassroom(record.classroomId);
    assertClassroomActive(
      classroom,
      "This class is archived and its assignments can't be scheduled or published.",
    );
  },

  async updateSchedule(id, input) {
    await prisma.assignment.update({
      where: { id },
      data: {
        status: input.status === "SCHEDULED" ? AssignmentStatus.SCHEDULED : AssignmentStatus.DRAFT,
        scheduledFor: input.scheduledFor,
      },
    });
  },

  async publish(id, publishedById, publishedAt) {
    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.PUBLISHED,
        scheduledFor: null,
        publishedAt,
        publishedById,
      },
    });
    return toSchedulableAssignment(updated);
  },

  async afterPublish(record) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: record.id },
      include: { classroom: { select: { title: true } } },
    });
    if (!assignment) {
      return;
    }
    await notifyAssignmentPublished({
      classroomId: assignment.classroomId,
      classroomTitle: assignment.classroom.title,
      authorId: assignment.authorId,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
    });
  },
};
