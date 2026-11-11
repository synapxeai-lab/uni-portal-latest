import type { SessionUser } from "@portal/shared/auth";

import { loadSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { UserRole, UserStatus } from "@/generated/prisma/enums";
import * as auditLogService from "@/features/admin/audit-logs/services/audit-log-service";
import * as classroomAdminService from "@/features/admin/classrooms/services/classroom-admin-service";
import * as userService from "@/features/admin/users/services/user-service";
import * as calendarService from "@/features/calendar/services/calendar-service";
import * as classroomService from "@/features/classroom/services/classroom-service";
import * as invitationService from "@/features/classroom/services/invitation-service";
import * as assignmentService from "@/features/classwork/services/assignment-service";
import * as materialService from "@/features/classwork/services/material-service";
import * as topicService from "@/features/classwork/services/topic-service";
import * as dashboardService from "@/features/dashboard/services/dashboard-service";
import * as notificationService from "@/features/notifications/services/notification-service";
import { parseReviewFilters } from "@/features/review/lib/review-params";
import * as reviewService from "@/features/review/services/review-service";
import * as searchService from "@/features/search/services/search-service";
import * as streamService from "@/features/stream/services/stream-service";
import * as submissionService from "@/features/submissions/services/submission-service";
import * as timetableService from "@/features/timetable/services/timetable-service";
import * as todoService from "@/features/todo/services/todo-service";

const NO_SUCH_ID = "00000000-0000-0000-0000-000000000000";

function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  image: string | null;
  avatarUrl: string | null;
  role: UserRole;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? user.avatarUrl ?? null,
    role: user.role,
  };
}

/** Runs every page-load read a user of this role triggers, discarding the results. */
async function warmUpAs(user: SessionUser): Promise<void> {
  const ignore = (promise: Promise<unknown>) => promise.catch(() => undefined);
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 31 * 86_400_000);

  const classrooms = await classroomService.listUserClassrooms(user.id);
  const scope = await classroomService.getClassroomSearchScope(user);

  await Promise.all([
    ignore(loadSession(NO_SUCH_ID, user.id)),
    ignore(notificationService.getUnreadCount(user.id)),
    ignore(notificationService.listNotifications(user.id, { limit: 20, unreadOnly: false })),
    ignore(classroomService.listArchivedClassrooms(user)),
    ignore(calendarService.getEvents(user, scope, { range: { start: monthAgo, end: now } })),
    ignore(calendarService.getFilterOptions(scope)),
    ignore(timetableService.listWeeklyTimetable(user)),
    ignore(searchService.search(user, { query: "warm up" })),
    user.role === UserRole.ADMIN
      ? ignore(dashboardService.getAdminDashboard())
      : user.role === UserRole.TEACHER
        ? ignore(dashboardService.getTeacherDashboard(user))
        : ignore(dashboardService.getStudentDashboard(user)),
    user.role === UserRole.STUDENT
      ? ignore(todoService.getStudentTodoItems(user, {}))
      : ignore(reviewService.getTeacherReviewQueue(user, parseReviewFilters({}))),
  ]);

  const classroom = classrooms[0];
  if (!classroom) {
    return;
  }
  const assignments = await classroomService
    .getClassroomForUser(classroom.id, user)
    .then(() => assignmentService.listClassroomAssignments(classroom.id, user))
    .catch(() => []);

  await Promise.all([
    ignore(classroomService.getClassroomRoster(classroom.id, user)),
    ignore(invitationService.listPendingInvitations(classroom.id, user)),
    ignore(streamService.listClassroomAnnouncements(classroom.id, user)),
    ignore(streamService.getStreamVersion(classroom.id, user)),
    ignore(topicService.listClassroomTopics(classroom.id, user)),
    ignore(materialService.listClassroomMaterials(classroom.id, user)),
  ]);

  const assignment = assignments[0];
  if (!assignment) {
    return;
  }
  await Promise.all([
    ignore(assignmentService.getAssignmentForUser(classroom.id, assignment.id, user)),
    ignore(submissionService.getSubmissionForStudent(assignment.id, user)),
    ignore(submissionService.getOwnSubmissionComments(assignment.id, user)),
    ignore(submissionService.getAssignmentSubmissions(classroom.id, assignment.id, user)),
    ignore(submissionService.getAssignmentGradeSummary(classroom.id, assignment.id, user)),
  ]);
}

/**
 * Prisma compiles each distinct query shape the first time it runs, which
 * makes the first request to every page after a (re)start noticeably slower
 * than all later ones. Running the page-load reads once per role at boot -
 * before the server accepts traffic - moves that cost out of user requests.
 * Never fails startup: an empty database simply warms less.
 */
export async function warmUp(): Promise<void> {
  const started = performance.now();
  try {
    await getSystemSettings();

    const roles = [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT];
    const users = await Promise.all(
      roles.map((role) =>
        prisma.user.findFirst({
          where: { role, status: UserStatus.ACTIVE },
          select: { id: true, name: true, email: true, image: true, avatarUrl: true, role: true },
        }),
      ),
    );

    for (const user of users) {
      if (user) {
        await warmUpAs(toSessionUser(user));
      }
    }

    await Promise.all([
      userService.listUsers({ page: 1 }),
      classroomAdminService.listClassrooms({ page: 1 }),
      auditLogService.listAuditLogs({ page: 1 }),
      timetableService.listClashes("pending"),
      timetableService.listActiveRooms(),
    ]);

    console.log(`[warm-up] query plans ready in ${Math.round(performance.now() - started)}ms`);
  } catch (error) {
    console.warn("[warm-up] skipped:", error instanceof Error ? error.message : error);
  }
}
