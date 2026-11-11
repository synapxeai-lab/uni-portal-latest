import type { SessionUser } from "@/auth/session";
import { getPlatformStats } from "@/features/admin/reports/services/analytics-service";
import {
  countArchivedClassrooms,
  listActiveClassroomIds,
  listArchivedClassrooms,
} from "@/features/classroom/services/classroom-service";
import { getUpcomingDeadlines } from "@/features/classwork/services/assignment-service";
import {
  getManageableClassrooms,
  getReviewSummary,
} from "@/features/review/services/review-service";
import {
  getScheduledContentStats,
  getUpcomingPublications,
} from "@/features/scheduling/services/scheduled-content-stats-service";
import { countStudentMissingAssignments } from "@/features/todo/services/todo-service";
import { prisma } from "@/lib/prisma";
import { ClassroomStatus } from "@/generated/prisma/enums";

import type { AdminDashboardData, StudentDashboardData, TeacherDashboardData } from "../types";

/**
 * Every tile is computed from the same manageable-classroom-id list, fetched
 * once and reused across four independent, parallel queries - no query loops
 * over classrooms, and each downstream call is itself already indexed
 * (see scheduled-content-stats-service and review-service for specifics).
 */
export async function getTeacherDashboard(user: SessionUser): Promise<TeacherDashboardData> {
  const manageableClassrooms = await getManageableClassrooms(user);
  const classroomIds = manageableClassrooms.map((classroom) => classroom.id);

  const [archivedClassroomCount, scheduledContent, reviewSummary, upcomingPublications] =
    await Promise.all([
      countArchivedClassrooms(user),
      getScheduledContentStats(classroomIds),
      getReviewSummary(classroomIds),
      getUpcomingPublications(classroomIds),
    ]);

  return {
    activeClassroomCount: classroomIds.length,
    archivedClassroomCount,
    scheduledContent,
    reviewSummary,
    upcomingPublications,
  };
}

export async function getStudentDashboard(user: SessionUser): Promise<StudentDashboardData> {
  const classroomIds = await listActiveClassroomIds(user.id);

  const [archivedClassrooms, upcomingDeadlines, missingAssignmentCount] = await Promise.all([
    listArchivedClassrooms(user),
    getUpcomingDeadlines(classroomIds),
    countStudentMissingAssignments(user.id, classroomIds),
  ]);

  return {
    activeClassroomCount: classroomIds.length,
    archivedClassrooms,
    upcomingDeadlines,
    missingAssignmentCount,
  };
}

/**
 * Platform-wide stats plus the teacher-style review queue and upcoming
 * publications across every active classroom. The classroom-id lookup runs
 * alongside the platform queries rather than ahead of them, so only the two
 * id-scoped queries wait on it.
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const activeClassroomIds = prisma.classroom
    .findMany({ where: { status: ClassroomStatus.ACTIVE }, select: { id: true } })
    .then((classrooms) => classrooms.map((classroom) => classroom.id));

  const [
    platformStats,
    archivedClassroomCount,
    scheduledContent,
    [reviewSummary, upcomingPublications],
  ] = await Promise.all([
    getPlatformStats(),
    prisma.classroom.count({ where: { status: ClassroomStatus.ARCHIVED } }),
    getScheduledContentStats(),
    activeClassroomIds.then((ids) =>
      Promise.all([getReviewSummary(ids), getUpcomingPublications(ids)] as const),
    ),
  ]);

  return {
    platformStats,
    archivedClassroomCount,
    scheduledContent,
    reviewSummary,
    upcomingPublications,
  };
}
