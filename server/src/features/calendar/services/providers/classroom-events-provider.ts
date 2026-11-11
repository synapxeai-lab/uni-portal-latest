import type { SessionUser } from "@/auth/session";
import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";

import { registerCalendarEventProvider } from "../calendar-providers";
import type { CalendarEvent, CalendarRange } from "../../types";

/**
 * "Classroom events" (Phase 16.2 spec: "if available") - the data model has
 * no dedicated classroom-events concept, so this surfaces the one genuine
 * classroom-level milestone it does have: the day each classroom was
 * created. Visible to anyone in scope (manager or plain member alike),
 * unlike scheduled content.
 */
async function getClassroomEvents(
  user: SessionUser,
  scope: ClassroomSearchScope,
  range: CalendarRange,
): Promise<CalendarEvent[]> {
  const classroomIds = [...scope.manageableClassroomIds, ...scope.memberOnlyClassroomIds];

  if (classroomIds.length === 0) {
    return [];
  }

  const classrooms = await prisma.classroom.findMany({
    where: {
      id: { in: classroomIds },
      deletedAt: null,
      createdAt: { gte: range.start, lte: range.end },
    },
    select: { id: true, title: true, createdAt: true },
  });

  return classrooms.map((classroom) => ({
    id: `classroom-created-${classroom.id}`,
    type: "classroom" as const,
    title: `${classroom.title} created`,
    start: classroom.createdAt,
    end: classroom.createdAt,
    allDay: true,
    href: `/classes/${classroom.id}/stream`,
    classroomId: classroom.id,
    classroomTitle: classroom.title,
    description: null,
  }));
}

registerCalendarEventProvider({ key: "classroom-events", getEvents: getClassroomEvents });
