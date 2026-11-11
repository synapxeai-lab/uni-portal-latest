import type { SessionUser } from "@/auth/session";
import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { AssignmentStatus } from "@/generated/prisma/enums";

import { registerCalendarEventProvider } from "../calendar-providers";
import type { CalendarEvent, CalendarRange } from "../../types";

/**
 * Students (and any plain member) only ever see a due date once the
 * assignment is actually Published or Closed - matches the visibility rule
 * search's searchAssignments() already enforces for member-only classrooms.
 * A classroom manager additionally sees Scheduled assignments' due dates
 * (useful for their own planning before it publishes) but not pure Drafts,
 * which don't yet represent committed work.
 */
const MEMBER_VISIBLE_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PUBLISHED,
  AssignmentStatus.CLOSED,
];
const MANAGER_VISIBLE_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.SCHEDULED,
  AssignmentStatus.PUBLISHED,
  AssignmentStatus.CLOSED,
];

async function getAssignmentDueDateEvents(
  user: SessionUser,
  scope: ClassroomSearchScope,
  range: CalendarRange,
): Promise<CalendarEvent[]> {
  const manageableIds = scope.manageableClassroomIds;
  const memberOnlyIds = scope.memberOnlyClassroomIds;

  if (manageableIds.length === 0 && memberOnlyIds.length === 0) {
    return [];
  }

  const visibilityOr: Prisma.AssignmentWhereInput[] = [];
  if (manageableIds.length > 0) {
    visibilityOr.push({
      classroomId: { in: manageableIds },
      status: { in: MANAGER_VISIBLE_STATUSES },
    });
  }
  if (memberOnlyIds.length > 0) {
    visibilityOr.push({
      classroomId: { in: memberOnlyIds },
      status: { in: MEMBER_VISIBLE_STATUSES },
    });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      dueDate: { gte: range.start, lte: range.end },
      OR: visibilityOr,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      classroomId: true,
      classroom: { select: { title: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return assignments.map((assignment) => ({
    id: `assignment-due-${assignment.id}`,
    type: "assignment-due" as const,
    title: assignment.title,
    // dueDate can't be null here - the where clause above already requires it to fall within range.
    start: assignment.dueDate as Date,
    end: assignment.dueDate as Date,
    allDay: false,
    href: `/classes/${assignment.classroomId}/classwork/${assignment.id}`,
    classroomId: assignment.classroomId,
    classroomTitle: assignment.classroom.title,
    description: assignment.status === AssignmentStatus.CLOSED ? "Closed" : null,
  }));
}

registerCalendarEventProvider({
  key: "assignment-due-date",
  getEvents: getAssignmentDueDateEvents,
});
