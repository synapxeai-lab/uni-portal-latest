import type { SessionUser } from "@/auth/session";
import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";

import { getRegisteredCalendarEventProviders } from "./calendar-providers";
// Side-effect import - registers every built-in event provider (Phase 16.2).
import "./providers";
import { narrowScopeToClassroom } from "../lib/calendar-scope";
import type { CalendarEvent, CalendarFilters } from "../types";

/**
 * The single entry point every calendar view (month/week/day) goes through.
 * It knows nothing about assignments, announcements, or any other concrete
 * content type - it only fans out to whatever providers have registered
 * themselves (see calendar-providers.ts and services/providers/), then
 * merges/filters/sorts the result. A future provider needs no changes here
 * or in any view component - just register itself and its events start
 * showing up.
 *
 * `scope` is computed once by the caller (see queries/calendar-queries.ts)
 * and passed in rather than derived here - the same scope is reused across
 * every provider's query and, when the /calendar page needs events for
 * several ranges at once (grid + today + upcoming + monthly agenda), across
 * every one of those calls too, instead of each independently re-querying
 * classroom membership (Phase 16.4).
 */
export async function getEvents(
  user: SessionUser,
  scope: ClassroomSearchScope,
  filters: CalendarFilters,
): Promise<CalendarEvent[]> {
  const providers = getRegisteredCalendarEventProviders();

  if (providers.length === 0) {
    return [];
  }

  // Narrowed once, up front, so a classroom-filtered query never asks any
  // provider to fetch events for classrooms the result would just discard.
  const scopedToClassroom = narrowScopeToClassroom(scope, filters.classroomId);

  const results = await Promise.all(
    providers.map((provider) => provider.getEvents(user, scopedToClassroom, filters.range)),
  );

  let events = results.flat();

  // Belt-and-braces, not redundant: narrowScopeToClassroom only affects
  // classroom-scoped providers. A future non-classroom-scoped provider (e.g.
  // an external ICS feed with classroomId: null) wouldn't be narrowed by
  // scope alone, so this is what actually guarantees a classroom filter
  // excludes it too.
  if (filters.classroomId) {
    events = events.filter((event) => event.classroomId === filters.classroomId);
  }

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const allowedTypes = new Set(filters.eventTypes);
    events = events.filter((event) => allowedTypes.has(event.type));
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface CalendarFilterOptions {
  classrooms: { id: string; title: string }[];
}

/** Populates the classroom filter dropdown - the same scope every provider above already enforces, so the filter never offers a classroom the viewer couldn't otherwise see events for. */
export async function getFilterOptions(
  scope: ClassroomSearchScope,
): Promise<CalendarFilterOptions> {
  const classroomIds = [...scope.manageableClassroomIds, ...scope.memberOnlyClassroomIds];

  if (classroomIds.length === 0) {
    return { classrooms: [] };
  }

  const classrooms = await prisma.classroom.findMany({
    where: { id: { in: classroomIds }, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return { classrooms };
}
