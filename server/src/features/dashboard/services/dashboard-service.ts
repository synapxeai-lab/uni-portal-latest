import type { SessionUser } from "@/auth/session";
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

import type { StudentDashboardData, TeacherDashboardData } from "../types";

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
