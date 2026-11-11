import type { SessionUser } from "@/auth/session";
import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { AnnouncementStatus, AssignmentStatus, MaterialStatus } from "@/generated/prisma/enums";

import { registerCalendarEventProvider } from "../calendar-providers";
import type { CalendarEvent, CalendarRange } from "../../types";

/**
 * Scheduled content (Draft -> Scheduled -> Published, see src/lib/scheduling
 * and the "Content Scheduling" feature) is only ever visible to whoever
 * manages that classroom, everywhere else in the app - so, unlike assignment
 * due dates, this provider never looks at memberOnlyClassroomIds at all.
 */
async function getScheduledContentEvents(
  user: SessionUser,
  scope: ClassroomSearchScope,
  range: CalendarRange,
): Promise<CalendarEvent[]> {
  const classroomIds = scope.manageableClassroomIds;

  if (classroomIds.length === 0) {
    return [];
  }

  const scheduledForInRange: Prisma.DateTimeFilter = { gte: range.start, lte: range.end };

  const [assignments, announcements, materials] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        deletedAt: null,
        classroomId: { in: classroomIds },
        status: AssignmentStatus.SCHEDULED,
        scheduledFor: scheduledForInRange,
      },
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        classroomId: true,
        classroom: { select: { title: true } },
      },
    }),
    prisma.announcement.findMany({
      where: {
        deletedAt: null,
        classroomId: { in: classroomIds },
        status: AnnouncementStatus.SCHEDULED,
        scheduledFor: scheduledForInRange,
      },
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        classroomId: true,
        classroom: { select: { title: true } },
      },
    }),
    prisma.material.findMany({
      where: {
        deletedAt: null,
        classroomId: { in: classroomIds },
        status: MaterialStatus.SCHEDULED,
        scheduledFor: scheduledForInRange,
      },
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        classroomId: true,
        classroom: { select: { title: true } },
      },
    }),
  ]);

  const assignmentEvents: CalendarEvent[] = assignments.map((item) => ({
    id: `assignment-scheduled-${item.id}`,
    type: "assignment-scheduled" as const,
    title: item.title,
    start: item.scheduledFor as Date,
    end: item.scheduledFor as Date,
    allDay: false,
    href: `/classes/${item.classroomId}/classwork/${item.id}`,
    classroomId: item.classroomId,
    classroomTitle: item.classroom.title,
    description: null,
  }));

  const announcementEvents: CalendarEvent[] = announcements.map((item) => ({
    id: `announcement-scheduled-${item.id}`,
    type: "announcement-scheduled" as const,
    title: item.title,
    start: item.scheduledFor as Date,
    end: item.scheduledFor as Date,
    allDay: false,
    href: `/classes/${item.classroomId}/stream`,
    classroomId: item.classroomId,
    classroomTitle: item.classroom.title,
    description: null,
  }));

  const materialEvents: CalendarEvent[] = materials.map((item) => ({
    id: `material-scheduled-${item.id}`,
    type: "material-scheduled" as const,
    title: item.title,
    start: item.scheduledFor as Date,
    end: item.scheduledFor as Date,
    allDay: false,
    href: `/classes/${item.classroomId}/classwork`,
    classroomId: item.classroomId,
    classroomTitle: item.classroom.title,
    description: null,
  }));

  return [...assignmentEvents, ...announcementEvents, ...materialEvents];
}

registerCalendarEventProvider({ key: "scheduled-content", getEvents: getScheduledContentEvents });
