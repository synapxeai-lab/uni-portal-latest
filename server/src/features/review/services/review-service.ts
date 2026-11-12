import type { SessionUser } from "@/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  AssignmentStatus,
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  SubmissionStatus,
  UserRole,
} from "@/generated/prisma/enums";

import type {
  ReviewFilterOptions,
  ReviewQueueFilters,
  ReviewQueueResult,
  ReviewQueueRow,
  ReviewQueueSummary,
} from "../types";

const PAGE_SIZE = 15;

/** Every non-terminal-draft state a submission can be in that a teacher might need to act on. */
const REVIEW_STATUSES = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.LATE,
  SubmissionStatus.REVIEWED,
  SubmissionStatus.RETURNED,
];

/**
 * The classrooms this user manages - platform admins bypass membership
 * entirely and see every active classroom, matching the same ADMIN-bypass
 * rule used by hasManagementAccess() for a single classroom. Archived/deleted
 * classrooms are excluded, since their content is read-only everywhere else.
 */
export async function getManageableClassrooms(
  user: SessionUser,
): Promise<{ id: string; title: string }[]> {
  if (user.role === UserRole.ADMIN) {
    return prisma.classroom.findMany({
      where: { status: ClassroomStatus.ACTIVE },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
  }

  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId: user.id,
      status: ClassroomMembershipStatus.ACTIVE,
      role: {
        in: [
          ClassroomMembershipRole.OWNER,
          ClassroomMembershipRole.TEACHER,
          ClassroomMembershipRole.CO_TEACHER,
        ],
      },
      classroom: { status: ClassroomStatus.ACTIVE },
    },
    select: { classroom: { select: { id: true, title: true } } },
    orderBy: { classroom: { title: "asc" } },
  });

  return memberships.map((membership) => membership.classroom);
}

/** Filter-dropdown option lists, scoped to the manageable classroom set - two indexed, targeted queries, run in parallel. */
async function getFilterOptions(classroomIds: string[]): Promise<ReviewFilterOptions> {
  if (classroomIds.length === 0) {
    return { classrooms: [], assignments: [], students: [] };
  }

  const [classrooms, assignments, memberships] = await Promise.all([
    prisma.classroom.findMany({
      where: { id: { in: classroomIds } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.assignment.findMany({
      where: {
        classroomId: { in: classroomIds },
        deletedAt: null,
        status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] },
      },
      select: { id: true, title: true, classroomId: true },
      orderBy: { title: "asc" },
    }),
    prisma.classroomMembership.findMany({
      where: {
        classroomId: { in: classroomIds },
        status: ClassroomMembershipStatus.ACTIVE,
        role: ClassroomMembershipRole.STUDENT,
      },
      select: { classroomId: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  return {
    classrooms,
    assignments,
    students: memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      classroomId: membership.classroomId,
    })),
  };
}

/**
 * SUBMITTED and LATE are turned-in work waiting to be graded (LATE matches
 * only the raw LATE status rather than re-deriving wasLate in SQL); GRADED is
 * REVIEWED (final); RETURNED is work out with the student for revision.
 */
function statusWhere(status: ReviewQueueFilters["status"]): Prisma.SubmissionWhereInput {
  switch (status) {
    case "SUBMITTED":
      return { status: SubmissionStatus.SUBMITTED };
    case "LATE":
      return { status: SubmissionStatus.LATE };
    case "GRADED":
      return { status: SubmissionStatus.REVIEWED };
    case "RETURNED":
      return { status: SubmissionStatus.RETURNED };
    default:
      return { status: { in: REVIEW_STATUSES } };
  }
}

function sortOrderBy(sort: ReviewQueueFilters["sort"]): Prisma.SubmissionOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { submittedAt: "asc" };
    case "dueDate":
      return { assignment: { dueDate: "asc" } };
    case "studentName":
      return { student: { name: "asc" } };
    case "assignmentName":
      return { assignment: { title: "asc" } };
    case "newest":
    default:
      return { submittedAt: "desc" };
  }
}

function toReviewQueueRow(row: {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  grade: number | null;
  assignment: {
    id: string;
    title: string;
    classroomId: string;
    dueDate: Date | null;
    points: number | null;
    classroom: { title: string };
  };
  student: { id: string; name: string; image: string | null; avatarUrl: string | null };
}): ReviewQueueRow {
  const wasLate = Boolean(
    row.submittedAt && row.assignment.dueDate && row.submittedAt > row.assignment.dueDate,
  );
  const displayStatus =
    row.status === SubmissionStatus.RETURNED
      ? "RETURNED"
      : row.status === SubmissionStatus.REVIEWED
        ? "GRADED"
        : row.status === SubmissionStatus.LATE || wasLate
        ? "LATE"
        : "SUBMITTED";

  return {
    submissionId: row.id,
    classroomId: row.assignment.classroomId,
    classroomTitle: row.assignment.classroom.title,
    assignmentId: row.assignment.id,
    assignmentTitle: row.assignment.title,
    studentId: row.student.id,
    studentName: row.student.name,
    studentImage: row.student.image ?? row.student.avatarUrl ?? null,
    status: row.status,
    displayStatus,
    submittedAt: row.submittedAt,
    dueDate: row.assignment.dueDate,
    grade: row.grade,
    maxPoints: row.assignment.points,
  };
}

interface SummaryRawRow {
  pending_reviews: bigint;
  late_submissions: bigint;
  returned_today: bigint;
  recently_submitted: bigint;
}

/**
 * Four summary counts in a single round trip via conditional aggregates,
 * rather than four separate prisma.count() calls.
 * Unlike the paginated row query, "late" here is computed precisely
 * (comparing submittedAt to the assignment's dueDate directly in SQL),
 * since an aggregate COUNT doesn't have the same fetch-then-filter option
 * the row-level query uses for display purposes.
 */
/** Exported for reuse by the dashboard feature's "Review Queue Summary" tile - same four aggregate counts, no row/filter-option fetching. */
export async function getReviewSummary(classroomIds: string[]): Promise<ReviewQueueSummary> {
  if (classroomIds.length === 0) {
    return { pendingReviews: 0, lateSubmissions: 0, returnedToday: 0, recentlySubmitted: 0 };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const recentCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<SummaryRawRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED', 'LATE')) AS pending_reviews,
      COUNT(*) FILTER (
        WHERE s.status = 'LATE'
           OR (s.status IN ('REVIEWED', 'RETURNED') AND a."dueDate" IS NOT NULL AND s."submittedAt" > a."dueDate")
      ) AS late_submissions,
      COUNT(*) FILTER (
        WHERE s.status = 'RETURNED' AND s."returnedAt" >= ${todayStart} AND s."returnedAt" < ${todayEnd}
      ) AS returned_today,
      COUNT(*) FILTER (WHERE s."submittedAt" >= ${recentCutoff}) AS recently_submitted
    FROM "Submission" s
    JOIN "Assignment" a ON a.id = s."assignmentId"
    WHERE a."classroomId" = ANY(${classroomIds})
      AND a."deletedAt" IS NULL
      AND a.status IN ('PUBLISHED', 'CLOSED')
      AND s."deletedAt" IS NULL
      AND s.status IN ('SUBMITTED', 'LATE', 'REVIEWED', 'RETURNED')
  `;

  const row = rows[0];
  return {
    pendingReviews: Number(row?.pending_reviews ?? 0),
    lateSubmissions: Number(row?.late_submissions ?? 0),
    returnedToday: Number(row?.returned_today ?? 0),
    recentlySubmitted: Number(row?.recently_submitted ?? 0),
  };
}

export async function getTeacherReviewQueue(
  user: SessionUser,
  filters: ReviewQueueFilters,
): Promise<ReviewQueueResult> {
  const manageableClassrooms = await getManageableClassrooms(user);
  const manageableClassroomIds = manageableClassrooms.map((classroom) => classroom.id);

  const effectiveClassroomIds =
    filters.classroomId && manageableClassroomIds.includes(filters.classroomId)
      ? [filters.classroomId]
      : manageableClassroomIds;

  if (effectiveClassroomIds.length === 0) {
    return {
      rows: [],
      summary: { pendingReviews: 0, lateSubmissions: 0, returnedToday: 0, recentlySubmitted: 0 },
      filterOptions: { classrooms: [], assignments: [], students: [] },
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      totalPages: 1,
    };
  }

  const where: Prisma.SubmissionWhereInput = {
    deletedAt: null,
    ...statusWhere(filters.status),
    assignment: {
      classroomId: { in: effectiveClassroomIds },
      deletedAt: null,
      status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] },
      ...(filters.dueBefore ? { dueDate: { lte: new Date(filters.dueBefore) } } : {}),
    },
    ...(filters.assignmentId ? { assignmentId: filters.assignmentId } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
  };

  // Row page, its total count, the summary tiles, and the filter-dropdown
  // option lists are four independent queries - run together rather than
  // sequentially, and each is itself a single indexed query (no per-row
  // follow-ups): the row query eager-loads assignment+classroom+student via
  // Prisma's include, which compiles to one query plan, not N+1 lookups.
  const [total, rawRows, summary, filterOptions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: sortOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        grade: true,
        assignment: {
          select: {
            id: true,
            title: true,
            classroomId: true,
            dueDate: true,
            points: true,
            classroom: { select: { title: true } },
          },
        },
        student: { select: { id: true, name: true, image: true, avatarUrl: true } },
      },
    }),
    getReviewSummary(manageableClassroomIds),
    getFilterOptions(manageableClassroomIds),
  ]);

  return {
    rows: rawRows.map(toReviewQueueRow),
    summary,
    filterOptions,
    total,
    page: filters.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
