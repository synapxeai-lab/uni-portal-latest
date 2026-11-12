import type { SessionUser } from "@/auth/session";
import {
  assertClassroomActive,
  assertManagementAccess,
} from "@/features/classroom/services/classroom-service";
import { canManageClassroom } from "@/features/classroom/lib/can-manage";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import {
  notifyPrivateComment,
  notifySubmissionGraded,
  notifySubmissionReturned,
} from "@/features/notifications/services/notification-generator";
import { getFileAttachmentsByEntityIds, type AttachedFileSummary } from "@/lib/file-attachments";
import { prisma } from "@/lib/prisma";
import { deleteAttachment, uploadAttachments } from "@/lib/storage/file-service";
import { Prisma } from "@/generated/prisma/client";
import {
  AssignmentStatus,
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  CommentVisibility,
  FileAttachmentType,
  SubmissionStatus,
  UserRole,
} from "@/generated/prisma/enums";

import { isLateSubmission, toDisplayStatus } from "../lib/display-status";
import type {
  GradeSummary,
  PrivateCommentSummary,
  SubmissionOverview,
  SubmissionReviewDetail,
  SubmissionView,
} from "../types";

export interface SubmissionInput {
  textAnswer?: string;
}

export interface GradeInput {
  grade: number;
  feedback?: string;
}

type AssignmentContext = {
  id: string;
  classroomId: string;
  status: AssignmentStatus;
  dueDate: Date | null;
  allowLateSubmission: boolean;
  classroom: { status: ClassroomStatus };
};

async function loadAssignmentContext(assignmentId: string): Promise<AssignmentContext> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classroomId: true,
      status: true,
      dueDate: true,
      allowLateSubmission: true,
      deletedAt: true,
      classroom: { select: { status: true } },
    },
  });

  // Drafts and deleted assignments are hidden from students entirely, not just forbidden.
  if (!assignment || assignment.deletedAt || assignment.status === AssignmentStatus.DRAFT) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  return assignment;
}

/** Any active, non-management classroom member may hold a submission - platform admins never can. */
async function assertStudentEligibility(classroomId: string, user: SessionUser): Promise<void> {
  if (user.role === UserRole.ADMIN) {
    throw new ClassroomServiceError("FORBIDDEN", "Admins cannot submit assignments.");
  }

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
  });

  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError("FORBIDDEN", "You are not a member of this classroom.");
  }

  if (canManageClassroom(membership.role)) {
    throw new ClassroomServiceError("FORBIDDEN", "Teachers cannot submit assignments.");
  }
}

type LockReason = SubmissionView["lockReason"];

/**
 * Why the assignment no longer accepts any change to student work (drafts,
 * turn-ins, or unsubmits), or null while it still does - the one rule the
 * student view (canEdit/canUnsubmit) shares with every mutation below.
 */
function getLockReason(assignment: AssignmentContext): LockReason {
  if (assignment.classroom.status === ClassroomStatus.ARCHIVED) return "ARCHIVED";
  if (assignment.status === AssignmentStatus.CLOSED) return "CLOSED";
  if (isPastDueAndLocked(assignment)) return "PAST_DUE";
  return null;
}

/**
 * Turned-in work a student may pull back to a draft: only while it's waiting
 * to be graded. Graded work (REVIEWED) is final; work returned for revision
 * (RETURNED) is already editable without unsubmitting.
 */
const UNSUBMITTABLE_STATUSES: SubmissionStatus[] = [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE];

/** Work a teacher can grade (or regrade) or return for revision. */
const GRADABLE_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.LATE,
  SubmissionStatus.REVIEWED,
];

/** States in which the student is working on their submission: a draft, or work returned for revision. */
const EDITABLE_STATUSES: SubmissionStatus[] = [SubmissionStatus.ASSIGNED, SubmissionStatus.RETURNED];

/**
 * The lock for one student's work. Work the teacher returned for revision can
 * be resubmitted after the due date (the teacher asked for it), so only an
 * archived class or a closed assignment locks it.
 */
function getLockReasonFor(assignment: AssignmentContext, status: SubmissionStatus | null): LockReason {
  const reason = getLockReason(assignment);
  return reason === "PAST_DUE" && status === SubmissionStatus.RETURNED ? null : reason;
}

function assertAssignmentAcceptsWork(assignment: AssignmentContext, status: SubmissionStatus | null = null): void {
  if (status === SubmissionStatus.RETURNED) {
    // Revising returned work: only an archived class or a closed assignment stops it.
    assertClassroomActive(assignment.classroom, "This class is archived and no longer accepts submissions.");
    if (assignment.status === AssignmentStatus.CLOSED) {
      throw new ClassroomServiceError(
        "VALIDATION_ERROR",
        "This assignment has been closed and no longer accepts submissions.",
      );
    }
    return;
  }

  assertClassroomActive(
    assignment.classroom,
    "This class is archived and no longer accepts submissions.",
  );

  if (assignment.status === AssignmentStatus.CLOSED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This assignment has been closed and no longer accepts submissions.",
    );
  }

  // Blocks draft saves as well as turn-ins - once the deadline locks the
  // assignment, there's nothing left the student can do with a draft.
  if (isPastDueAndLocked(assignment)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "The due date has passed - work can't be turned in after the due date.",
    );
  }
}

function isPastDueAndLocked(assignment: AssignmentContext): boolean {
  return (
    !assignment.allowLateSubmission &&
    assignment.dueDate !== null &&
    new Date() > assignment.dueDate
  );
}

async function findSubmissionByAssignmentAndStudent(assignmentId: string, studentId: string) {
  return prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
  });
}

type SubmissionRow = NonNullable<Awaited<ReturnType<typeof findSubmissionByAssignmentAndStudent>>>;

// A student's in-progress draft (status ASSIGNED) is never visible to a
// teacher - it's treated identically to "no submission at all" everywhere a
// teacher looks (overview counts, the review page, and private comments).
// Only the student's own queries see draft content.
function toTeacherVisibleSubmission(row: SubmissionRow | null): SubmissionRow | null {
  if (!row || row.deletedAt || row.status === SubmissionStatus.ASSIGNED) {
    return null;
  }
  return row;
}

/**
 * Writes the student's draft or turn-in, but only over a row that is still a
 * draft - checked in the same statement as the write, so two concurrent
 * requests (a double-click, a second tab) can't both turn in, and a slow
 * draft save can't silently revert work that was just turned in.
 */
async function writeOverDraft(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  studentId: string,
  existing: SubmissionRow | null,
  data: { textAnswer: string | null; status: SubmissionStatus; submittedAt: Date | null },
  conflictMessage: string,
): Promise<SubmissionRow> {
  if (existing) {
    const { count } = await tx.submission.updateMany({
      where: { id: existing.id, status: { in: EDITABLE_STATUSES } },
      data,
    });
    if (count === 0) {
      throw new ClassroomServiceError("VALIDATION_ERROR", conflictMessage);
    }
    return tx.submission.findUniqueOrThrow({ where: { id: existing.id } });
  }

  try {
    return await tx.submission.create({ data: { assignmentId, studentId, ...data } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ClassroomServiceError("VALIDATION_ERROR", conflictMessage);
    }
    throw error;
  }
}

async function attachFiles(
  tx: Prisma.TransactionClient,
  submissionId: string,
  files: File[],
  uploadedById: string,
): Promise<void> {
  await uploadAttachments({
    files,
    attachmentType: FileAttachmentType.SUBMISSION,
    entityId: submissionId,
    uploadedById,
    tx,
  });
}

function toSubmissionView(
  submission: SubmissionRow | null,
  assignment: AssignmentContext,
  attachments: AttachedFileSummary[],
): SubmissionView {
  if (!submission) {
    const lockReason = getLockReason(assignment);
    return { submission: null, canEdit: lockReason === null, canUnsubmit: false, lockReason };
  }

  const lockReason = getLockReasonFor(assignment, submission.status);
  const canEdit = EDITABLE_STATUSES.includes(submission.status) && lockReason === null;
  // Unsubmitting past the due date is fine while late work is accepted - the
  // resubmission is simply marked Late. When it isn't, the lock applies, so a
  // student can't pull back work they'd then be unable to turn in again.
  const canUnsubmit = UNSUBMITTABLE_STATUSES.includes(submission.status) && lockReason === null;

  // Saving a grade is final, so the student sees it straight away. Work
  // returned for revision has no grade, but the teacher's note says what to fix.
  const isGraded = submission.status === SubmissionStatus.REVIEWED;
  const hasFeedback = isGraded || submission.status === SubmissionStatus.RETURNED;

  return {
    submission: {
      id: submission.id,
      textAnswer: submission.textAnswer,
      status: submission.status,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
      returnedAt: submission.returnedAt,
      grade: isGraded ? submission.grade : null,
      feedback: hasFeedback ? submission.feedback : null,
      gradedAt: isGraded ? submission.gradedAt : null,
      attachments,
    },
    canEdit,
    canUnsubmit,
    lockReason,
  };
}

export async function getSubmissionForStudent(
  assignmentId: string,
  user: SessionUser,
): Promise<SubmissionView> {
  const assignment = await loadAssignmentContext(assignmentId);
  await assertStudentEligibility(assignment.classroomId, user);

  const submission = await findSubmissionByAssignmentAndStudent(assignmentId, user.id);

  if (!submission || submission.deletedAt) {
    return toSubmissionView(null, assignment, []);
  }

  const attachmentsBySubmissionId = await getFileAttachmentsByEntityIds(
    [submission.id],
    FileAttachmentType.SUBMISSION,
  );

  return toSubmissionView(
    submission,
    assignment,
    attachmentsBySubmissionId.get(submission.id) ?? [],
  );
}

/** Shared upsert used by both the draft-save and submit flows. */
export async function createOrUpdateSubmission(
  assignmentId: string,
  user: SessionUser,
  input: SubmissionInput,
  files: File[],
): Promise<SubmissionView> {
  const assignment = await loadAssignmentContext(assignmentId);
  await assertStudentEligibility(assignment.classroomId, user);

  const existing = await findSubmissionByAssignmentAndStudent(assignmentId, user.id);
  assertAssignmentAcceptsWork(assignment, existing?.status ?? null);

  if (existing && !EDITABLE_STATUSES.includes(existing.status)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      existing.status === SubmissionStatus.REVIEWED
        ? "This work has been graded and can't be changed."
        : "Unsubmit your work before making changes.",
    );
  }

  const submission = await prisma.$transaction(async (tx) => {
    const row = await writeOverDraft(
      tx,
      assignmentId,
      user.id,
      existing,
      {
        textAnswer: input.textAnswer ?? null,
        // A draft of work returned for revision stays "returned" until it's turned in again.
        status: existing?.status === SubmissionStatus.RETURNED ? SubmissionStatus.RETURNED : SubmissionStatus.ASSIGNED,
        submittedAt: existing?.status === SubmissionStatus.RETURNED ? existing.submittedAt : null,
      },
      "This assignment was just turned in - unsubmit it before making changes.",
    );

    await attachFiles(tx, row.id, files, user.id);

    return row;
  });

  const attachmentsBySubmissionId = await getFileAttachmentsByEntityIds(
    [submission.id],
    FileAttachmentType.SUBMISSION,
  );
  return toSubmissionView(
    submission,
    assignment,
    attachmentsBySubmissionId.get(submission.id) ?? [],
  );
}

export async function submitSubmission(
  assignmentId: string,
  user: SessionUser,
  input: SubmissionInput,
  files: File[],
): Promise<SubmissionView> {
  const assignment = await loadAssignmentContext(assignmentId);
  await assertStudentEligibility(assignment.classroomId, user);

  const existing = await findSubmissionByAssignmentAndStudent(assignmentId, user.id);
  assertAssignmentAcceptsWork(assignment, existing?.status ?? null);

  if (existing && !EDITABLE_STATUSES.includes(existing.status)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This assignment has already been turned in.",
    );
  }

  const now = new Date();
  // Late work only reaches this point when allowLateSubmission is on -
  // assertAssignmentAcceptsWork has already rejected it otherwise (except for
  // a revision the teacher asked for, which is accepted and marked Late).
  const nextStatus = isLateSubmission(now, assignment.dueDate)
    ? SubmissionStatus.LATE
    : SubmissionStatus.SUBMITTED;

  const submission = await prisma.$transaction(async (tx) => {
    const row = await writeOverDraft(
      tx,
      assignmentId,
      user.id,
      existing,
      { textAnswer: input.textAnswer ?? null, status: nextStatus, submittedAt: now },
      "This assignment has already been turned in.",
    );

    await attachFiles(tx, row.id, files, user.id);

    return row;
  });

  const attachmentsBySubmissionId = await getFileAttachmentsByEntityIds(
    [submission.id],
    FileAttachmentType.SUBMISSION,
  );
  return toSubmissionView(
    submission,
    assignment,
    attachmentsBySubmissionId.get(submission.id) ?? [],
  );
}

export async function unsubmitSubmission(
  assignmentId: string,
  user: SessionUser,
): Promise<SubmissionView> {
  const assignment = await loadAssignmentContext(assignmentId);
  await assertStudentEligibility(assignment.classroomId, user);
  assertClassroomActive(
    assignment.classroom,
    "This class is archived and submissions can no longer be changed.",
  );

  const existing = await findSubmissionByAssignmentAndStudent(assignmentId, user.id);

  if (!existing || existing.deletedAt || !UNSUBMITTABLE_STATUSES.includes(existing.status)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      existing?.status === SubmissionStatus.REVIEWED
        ? "This work has been graded and can't be unsubmitted."
        : "Only turned-in work that hasn't been graded can be unsubmitted.",
    );
  }

  if (assignment.status === AssignmentStatus.CLOSED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This assignment has been closed by your teacher and can no longer be unsubmitted.",
    );
  }

  if (isPastDueAndLocked(assignment)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "The due date has passed and late work isn't accepted - this can no longer be unsubmitted.",
    );
  }

  // Conditional on the status just checked, so a teacher's return landing at
  // the same moment isn't overwritten. Any grade stays on the row, hidden from
  // the student until the teacher returns the resubmitted work.
  const { count } = await prisma.submission.updateMany({
    where: { id: existing.id, status: existing.status },
    data: { status: SubmissionStatus.ASSIGNED, submittedAt: null },
  });
  if (count === 0) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This work just changed - reload the page and try again.",
    );
  }
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: existing.id } });

  const attachmentsBySubmissionId = await getFileAttachmentsByEntityIds(
    [submission.id],
    FileAttachmentType.SUBMISSION,
  );
  return toSubmissionView(
    submission,
    assignment,
    attachmentsBySubmissionId.get(submission.id) ?? [],
  );
}

export async function removeSubmissionAttachment(
  submissionId: string,
  fileAttachmentId: string,
  user: SessionUser,
): Promise<void> {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });

  if (!submission || submission.deletedAt) {
    throw new ClassroomServiceError("NOT_FOUND", "Submission not found.");
  }

  if (submission.studentId !== user.id) {
    throw new ClassroomServiceError("FORBIDDEN", "You can only edit your own submission.");
  }

  if (!EDITABLE_STATUSES.includes(submission.status)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      submission.status === SubmissionStatus.REVIEWED
        ? "This work has been graded and can't be changed."
        : "Unsubmit your work before removing an attachment.",
    );
  }

  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: fileAttachmentId },
  });

  if (
    !attachment ||
    attachment.attachmentType !== FileAttachmentType.SUBMISSION ||
    attachment.entityId !== submissionId
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Attachment not found.");
  }

  await deleteAttachment(fileAttachmentId);
}

// ---------------------------------------------------------------------------
// Teacher review workflow (Phase 9.2) - everything below is manager-only,
// scoped to the specific classroom the assignment belongs to.
// ---------------------------------------------------------------------------

/** Confirms the assignment exists, isn't deleted, and actually belongs to this classroom - returns its title for callers that need it (e.g. a notification message) without a second query. */
async function assertAssignmentInClassroom(
  classroomId: string,
  assignmentId: string,
): Promise<{ title: string }> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { classroomId: true, deletedAt: true, title: true },
  });

  if (!assignment || assignment.deletedAt || assignment.classroomId !== classroomId) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  return { title: assignment.title };
}

type ManagedAssignment = {
  id: string;
  classroomId: string;
  title: string;
  status: AssignmentStatus;
  dueDate: Date | null;
  points: number | null;
};

/**
 * The manager-only counterpart to assertAssignmentInClassroom - asserts
 * management access to classroomId first (cheap, no assignment row needed),
 * then loads the fields grading/review functions need (status, dueDate,
 * points) so they don't each issue their own follow-up query.
 */
async function loadAssignmentForManager(
  classroomId: string,
  assignmentId: string,
  user: SessionUser,
): Promise<ManagedAssignment> {
  await assertManagementAccess(classroomId, user);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classroomId: true,
      title: true,
      status: true,
      dueDate: true,
      points: true,
      deletedAt: true,
    },
  });

  if (!assignment || assignment.deletedAt || assignment.classroomId !== classroomId) {
    throw new ClassroomServiceError("NOT_FOUND", "Assignment not found.");
  }

  return assignment;
}

function toDisplayName(user: { image: string | null; avatarUrl: string | null }): string | null {
  return user.image ?? user.avatarUrl ?? null;
}

export async function getAssignmentSubmissions(
  classroomId: string,
  assignmentId: string,
  user: SessionUser,
): Promise<SubmissionOverview> {
  // Per-classroom check (not just "is a teacher somewhere") - a teacher who
  // doesn't manage this specific classroom gets FORBIDDEN, full stop.
  const assignment = await loadAssignmentForManager(classroomId, assignmentId, user);

  const members = await prisma.classroomMembership.findMany({
    where: {
      classroomId,
      status: ClassroomMembershipStatus.ACTIVE,
      role: ClassroomMembershipRole.STUDENT,
    },
    include: { user: { select: { id: true, name: true, image: true, avatarUrl: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const submissions = await prisma.submission.findMany({
    where: {
      assignmentId,
      deletedAt: null,
      studentId: { in: members.map((member) => member.userId) },
    },
  });
  const submissionByStudentId = new Map(submissions.map((row) => [row.studentId, row]));

  // Not turned in and no longer can be on time - same rule as the To-do board.
  const isMissing =
    assignment.status === AssignmentStatus.CLOSED ||
    (assignment.dueDate !== null && assignment.dueDate < new Date());

  const rows = members.map((member) => {
    // A draft-in-progress (ASSIGNED) submission is invisible to the teacher -
    // it reads exactly like the student never started, by design.
    const submission = toTeacherVisibleSubmission(submissionByStudentId.get(member.userId) ?? null);
    return {
      studentId: member.userId,
      studentName: member.user.name,
      studentImage: toDisplayName(member.user),
      displayStatus: toDisplayStatus(submission?.status ?? null, {
        wasLate: isLateSubmission(submission?.submittedAt ?? null, assignment.dueDate),
        missing: isMissing,
      }),
      submittedAt: submission?.submittedAt ?? null,
      updatedAt: submission?.updatedAt ?? null,
      grade: submission?.grade ?? null,
      hasSubmission: submission !== null,
    };
  });

  const overview: SubmissionOverview = {
    totalStudents: rows.length,
    submitted: 0,
    notSubmitted: 0,
    missing: 0,
    late: 0,
    graded: 0,
    returned: 0,
    rows,
  };

  for (const row of rows) {
    if (row.displayStatus === "SUBMITTED") overview.submitted += 1;
    else if (row.displayStatus === "NOT_SUBMITTED") overview.notSubmitted += 1;
    else if (row.displayStatus === "MISSING") overview.missing += 1;
    else if (row.displayStatus === "LATE") overview.late += 1;
    else if (row.displayStatus === "GRADED") overview.graded += 1;
    else if (row.displayStatus === "RETURNED") overview.returned += 1;
  }

  return overview;
}

async function assertActiveStudentOfClassroom(
  classroomId: string,
  studentId: string,
): Promise<void> {
  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: studentId } },
  });

  if (
    !membership ||
    membership.status !== ClassroomMembershipStatus.ACTIVE ||
    canManageClassroom(membership.role)
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Student not found in this classroom.");
  }
}

async function listPrivateComments(
  submissionId: string,
  viewerId: string,
  studentId: string,
): Promise<PrivateCommentSummary[]> {
  const comments = await prisma.comment.findMany({
    where: { submissionId, deletedAt: null, visibility: CommentVisibility.PRIVATE },
    include: { author: { select: { id: true, name: true, image: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Only the owning student or a classroom manager can ever author a private
  // comment on this submission (enforced in createPrivateComment) - so any
  // author who isn't the student is necessarily a teacher. No extra query needed.
  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      image: toDisplayName(comment.author),
      isTeacher: comment.authorId !== studentId,
    },
    canDelete: comment.authorId === viewerId,
  }));
}

export async function getSubmissionDetails(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  user: SessionUser,
): Promise<SubmissionReviewDetail> {
  const assignment = await loadAssignmentForManager(classroomId, assignmentId, user);
  await assertActiveStudentOfClassroom(classroomId, studentId);

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, image: true, avatarUrl: true },
  });

  if (!student) {
    throw new ClassroomServiceError("NOT_FOUND", "Student not found in this classroom.");
  }

  const submission = toTeacherVisibleSubmission(
    await findSubmissionByAssignmentAndStudent(assignmentId, studentId),
  );

  const [attachmentsBySubmissionId, comments] = await Promise.all([
    submission
      ? getFileAttachmentsByEntityIds([submission.id], FileAttachmentType.SUBMISSION)
      : Promise.resolve(new Map<string, AttachedFileSummary[]>()),
    submission ? listPrivateComments(submission.id, user.id, studentId) : Promise.resolve([]),
  ]);

  // Turned-in or graded work can be graded (again) or sent back for revision;
  // work already out for revision waits for the student to turn it in again.
  const canReturn = submission !== null && GRADABLE_STATUSES.includes(submission.status);

  return {
    student: { id: student.id, name: student.name, image: toDisplayName(student) },
    submission: submission
      ? {
          id: submission.id,
          textAnswer: submission.textAnswer,
          status: submission.status,
          submittedAt: submission.submittedAt,
          updatedAt: submission.updatedAt,
          returnedAt: submission.returnedAt,
          grade: submission.grade,
          feedback: submission.feedback,
          gradedAt: submission.gradedAt,
          attachments: attachmentsBySubmissionId.get(submission.id) ?? [],
        }
      : null,
    canReturn,
    canGrade: canReturn && assignment.points !== null,
    comments,
  };
}

export async function getOwnSubmissionComments(
  assignmentId: string,
  user: SessionUser,
): Promise<PrivateCommentSummary[]> {
  const assignment = await loadAssignmentContext(assignmentId);
  await assertStudentEligibility(assignment.classroomId, user);

  const submission = await findSubmissionByAssignmentAndStudent(assignmentId, user.id);

  if (!submission || submission.deletedAt) {
    return [];
  }

  return listPrivateComments(submission.id, user.id, user.id);
}

export async function createPrivateComment(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  user: SessionUser,
  content: string,
): Promise<PrivateCommentSummary> {
  const assignment = await assertAssignmentInClassroom(classroomId, assignmentId);

  const isOwner = user.id === studentId;
  if (isOwner) {
    await assertStudentEligibility(classroomId, user);
  } else {
    await assertManagementAccess(classroomId, user);
    await assertActiveStudentOfClassroom(classroomId, studentId);
  }

  const rawSubmission = await findSubmissionByAssignmentAndStudent(assignmentId, studentId);
  // A teacher can't comment on (or thereby detect) a draft-in-progress - only
  // the owning student can interact with their own submission at that stage.
  const submission = isOwner
    ? rawSubmission && !rawSubmission.deletedAt
      ? rawSubmission
      : null
    : toTeacherVisibleSubmission(rawSubmission);

  if (!submission) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "There's no submission to comment on yet.");
  }

  const created = await prisma.comment.create({
    data: {
      submissionId: submission.id,
      authorId: user.id,
      content,
      visibility: CommentVisibility.PRIVATE,
    },
    include: { author: { select: { id: true, name: true, image: true, avatarUrl: true } } },
  });

  await notifyPrivateComment({
    classroomId,
    assignmentId,
    assignmentTitle: assignment.title,
    studentId,
    authorId: user.id,
    authorIsTeacher: created.authorId !== studentId,
  });

  return {
    id: created.id,
    content: created.content,
    createdAt: created.createdAt,
    author: {
      id: created.author.id,
      name: created.author.name,
      image: toDisplayName(created.author),
      isTeacher: created.authorId !== studentId,
    },
    canDelete: true,
  };
}

export async function deletePrivateComment(commentId: string, user: SessionUser): Promise<void> {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!comment || comment.deletedAt || !comment.submissionId) {
    throw new ClassroomServiceError("NOT_FOUND", "Comment not found.");
  }

  // Deletion is author-only in this phase - even a teacher can't remove a
  // student's private comment (or another teacher's), only their own.
  if (comment.authorId !== user.id) {
    throw new ClassroomServiceError("FORBIDDEN", "You can only delete your own comments.");
  }

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
}

/**
 * Returns a submission to the student - whether or not it's been graded.
 * A grade already set (status REVIEWED) gets locked and timestamped here,
 * not when it was first assigned - matching Google Classroom, where a grade
 * stays private and editable until the teacher explicitly returns it.
 */
/**
 * Sends work back to the student for revision, with a note on what to
 * improve. It isn't graded: any grade is cleared (the caller also removes it
 * from the marks sheet), and the student revises and turns it in again.
 */
export async function returnSubmission(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  user: SessionUser,
  note?: string,
): Promise<SubmissionReviewDetail> {
  const assignment = await loadAssignmentForManager(classroomId, assignmentId, user);
  await assertActiveStudentOfClassroom(classroomId, studentId);

  const submission = await findSubmissionByAssignmentAndStudent(assignmentId, studentId);

  if (!submission || submission.deletedAt || submission.status === SubmissionStatus.ASSIGNED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This student hasn't submitted anything yet.",
    );
  }

  if (submission.status === SubmissionStatus.RETURNED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This work is already with the student for revision.",
    );
  }

  if (!GRADABLE_STATUSES.includes(submission.status)) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "Only turned-in work can be returned for revision.",
    );
  }

  // Conditional on the status just checked, so a student's change landing at the same moment isn't overwritten.
  const { count } = await prisma.submission.updateMany({
    where: { id: submission.id, status: submission.status },
    data: {
      status: SubmissionStatus.RETURNED,
      returnedAt: new Date(),
      grade: null,
      gradedAt: null,
      feedback: note?.trim() ? note.trim() : submission.feedback,
    },
  });
  if (count === 0) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "This work just changed - reload the page and try again.");
  }

  await notifySubmissionReturned({
    studentId,
    classroomId,
    assignmentId,
    assignmentTitle: assignment.title,
  });

  return getSubmissionDetails(classroomId, assignmentId, studentId, user);
}

/**
 * Grades turned-in work, or changes an existing grade. Grading is final: the
 * student sees the grade and feedback straight away, and the caller copies it
 * to the marks sheet when the assignment is linked to a marks item.
 */
export async function setSubmissionGrade(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  user: SessionUser,
  input: GradeInput,
): Promise<SubmissionReviewDetail> {
  const assignment = await loadAssignmentForManager(classroomId, assignmentId, user);
  await assertActiveStudentOfClassroom(classroomId, studentId);

  if (assignment.status === AssignmentStatus.DRAFT) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This assignment hasn't been published yet.",
    );
  }

  if (assignment.points === null) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This assignment has no maximum points set, so it can't be graded.",
    );
  }

  if (input.grade < 0) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "Grade cannot be negative.");
  }

  if (input.grade > assignment.points) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      `Grade cannot exceed the maximum of ${assignment.points} points.`,
    );
  }

  const submission = toTeacherVisibleSubmission(
    await findSubmissionByAssignmentAndStudent(assignmentId, studentId),
  );

  if (!submission) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This student hasn't submitted anything yet.",
    );
  }

  if (submission.status === SubmissionStatus.RETURNED) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "This work is with the student for revision - grade it once they turn it in again.",
    );
  }

  const wasGraded = submission.status === SubmissionStatus.REVIEWED;
  const { count } = await prisma.submission.updateMany({
    where: { id: submission.id, status: submission.status },
    data: {
      grade: input.grade,
      feedback: input.feedback ?? null,
      status: SubmissionStatus.REVIEWED,
      gradedAt: new Date(),
    },
  });
  if (count === 0) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "This work just changed - reload the page and try again.");
  }

  await notifySubmissionGraded({
    studentId,
    classroomId,
    assignmentId,
    assignmentTitle: assignment.title,
    regraded: wasGraded,
  });

  return getSubmissionDetails(classroomId, assignmentId, studentId, user);
}

export async function getAssignmentGradeSummary(
  classroomId: string,
  assignmentId: string,
  user: SessionUser,
): Promise<GradeSummary> {
  await loadAssignmentForManager(classroomId, assignmentId, user);

  const [aggregate, pendingCount, returnedCount] = await Promise.all([
    prisma.submission.aggregate({
      where: { assignmentId, deletedAt: null, grade: { not: null } },
      _avg: { grade: true },
      _max: { grade: true },
      _min: { grade: true },
      _count: { grade: true },
    }),
    prisma.submission.count({
      where: {
        assignmentId,
        deletedAt: null,
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE] },
      },
    }),
    prisma.submission.count({
      where: { assignmentId, deletedAt: null, status: SubmissionStatus.RETURNED },
    }),
  ]);

  return {
    gradedCount: aggregate._count.grade,
    pendingCount,
    returnedCount,
    averageGrade: aggregate._avg.grade,
    highestGrade: aggregate._max.grade,
    lowestGrade: aggregate._min.grade,
  };
}
