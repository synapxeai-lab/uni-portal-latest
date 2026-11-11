import type { SessionUser } from "@/auth/session";
import { listActiveClassroomIds } from "@/features/classroom/services/classroom-service";
import { isLateSubmission, toDisplayStatus } from "@/features/submissions/lib/display-status";
import { getFileAttachmentsByEntityIds } from "@/lib/file-attachments";
import { prisma } from "@/lib/prisma";
import {
  AssignmentStatus,
  FileAttachmentType,
  type SubmissionStatus,
} from "@/generated/prisma/enums";

import { getDueGroup } from "../lib/todo-date";
import type { TodoAssignmentItem, TodoFilters } from "../types";

const VISIBLE_STATUSES: AssignmentStatus[] = [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED];

/** A submission counts as "done" the moment it's actually been turned in - ASSIGNED (an in-progress draft, never turned in) does not, everything past it does, including a late one. */
const SUBMITTED_STATUSES: SubmissionStatus[] = ["SUBMITTED", "LATE", "REVIEWED", "RETURNED"];

/**
 * The Student To-do board: every assignment the signed-in user can currently
 * see (published or closed, in an active classroom they're an active member
 * of, never deleted), categorized into exactly one of Assigned/Missing/Done
 * and grouped by due date - see the category rule below and getDueGroup for
 * the grouping rule. One query for assignments + this student's own
 * submission (a filtered relation include, not a per-assignment follow-up
 * query) plus one batched attachment lookup - no N+1 regardless of how many
 * assignments are in scope.
 */
export async function getStudentTodoItems(
  user: SessionUser,
  filters: TodoFilters,
): Promise<TodoAssignmentItem[]> {
  const classroomIds = await listActiveClassroomIds(user.id);

  const scopedClassroomIds = filters.classroomId
    ? classroomIds.filter((id) => id === filters.classroomId)
    : classroomIds;

  if (scopedClassroomIds.length === 0) {
    return [];
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      classroomId: { in: scopedClassroomIds },
      deletedAt: null,
      status: { in: VISIBLE_STATUSES },
    },
    select: {
      id: true,
      title: true,
      classroomId: true,
      classroom: { select: { title: true } },
      dueDate: true,
      points: true,
      status: true,
      submissions: {
        where: { studentId: user.id, deletedAt: null },
        select: { status: true, submittedAt: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const attachmentsByAssignmentId = await getFileAttachmentsByEntityIds(
    assignments.map((assignment) => assignment.id),
    FileAttachmentType.ASSIGNMENT,
  );

  const now = new Date();

  return assignments.map((assignment) => {
    const submission = assignment.submissions[0] ?? null;
    const isSubmitted = submission !== null && SUBMITTED_STATUSES.includes(submission.status);
    const isOverdue = assignment.dueDate !== null && assignment.dueDate < now;
    const isClosed = assignment.status === AssignmentStatus.CLOSED;

    // Every visible assignment lands in exactly one bucket:
    // - Done: already turned in, regardless of due date, grading, or lateness.
    // - Missing: not turned in, and either the due date has passed or the
    //   teacher has closed it (closing also stops accepting new work, so an
    //   unsubmitted closed assignment is effectively missed the same way an
    //   overdue one is).
    // - Assigned: everything else - not turned in, still open, and either
    //   has no due date or one that hasn't passed yet.
    const category: TodoAssignmentItem["category"] = isSubmitted
      ? "done"
      : isOverdue || isClosed
        ? "missing"
        : "assigned";

    const wasLate = isLateSubmission(submission?.submittedAt ?? null, assignment.dueDate);

    return {
      id: assignment.id,
      title: assignment.title,
      classroomId: assignment.classroomId,
      classroomTitle: assignment.classroom.title,
      dueDate: assignment.dueDate,
      points: assignment.points,
      attachments: attachmentsByAssignmentId.get(assignment.id) ?? [],
      assignmentStatus: assignment.status,
      submissionStatus: toDisplayStatus(submission?.status ?? null, {
        wasLate,
        missing: category === "missing",
      }),
      category,
      dueGroup: getDueGroup(assignment.dueDate, now),
    };
  });
}

/**
 * How many assignments the To-do board would put in its Missing bucket - the
 * same rule as getStudentTodoItems (visible, not turned in, and either past
 * due or closed), as a single count query for the dashboard.
 */
export async function countStudentMissingAssignments(
  studentId: string,
  classroomIds: string[],
): Promise<number> {
  if (classroomIds.length === 0) {
    return 0;
  }

  return prisma.assignment.count({
    where: {
      classroomId: { in: classroomIds },
      deletedAt: null,
      status: { in: VISIBLE_STATUSES },
      OR: [{ status: AssignmentStatus.CLOSED }, { dueDate: { lt: new Date() } }],
      submissions: {
        none: { studentId, deletedAt: null, status: { in: SUBMITTED_STATUSES } },
      },
    },
  });
}
