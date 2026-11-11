import type { SessionUser } from "@/auth/session";
import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";

import type { CalendarEvent, CalendarRange } from "../types";

/**
 * The contract any feature module implements to plug its own content into
 * the calendar - e.g. the built-in classwork/scheduling providers today, or
 * a future recurring-event source or an external ICS/Google Calendar/Outlook
 * sync tomorrow. Every provider receives the same two things:
 *
 * - `scope` - the viewer's classroom visibility, computed once per request
 *   by the caller (see calendar-service.ts) rather than by each provider
 *   independently. A classroom-backed provider should read this instead of
 *   querying membership itself, so it never runs its own auth query and is
 *   automatically kept in sync with the same rule every other provider uses.
 * - `user` - the full session user, for anything a provider needs that
 *   `scope` doesn't cover (e.g. a future external-calendar provider looking
 *   up that user's linked Google/Outlook account rather than a classroom).
 *
 * Authorization is still each provider's own responsibility: `getEvents`
 * must only return events `user` is actually allowed to see, using `scope`
 * for anything classroom-shaped and its own judgment for anything else.
 */
export interface CalendarEventProvider {
  /** Unique key identifying the source module - used for de-duplicating registration and in error messages, never shown to users. */
  key: string;
  getEvents(
    user: SessionUser,
    scope: ClassroomSearchScope,
    range: CalendarRange,
  ): Promise<CalendarEvent[]>;
}

/** Registered providers, in registration order. */
const providers: CalendarEventProvider[] = [];

/**
 * Called once, at module load, by any feature that wants its events on the
 * calendar (e.g. a top-level import in that feature's service file, mirroring
 * how `src/auth/index.ts` wires up NextAuth once at import time).
 */
export function registerCalendarEventProvider(provider: CalendarEventProvider): void {
  if (providers.some((existing) => existing.key === provider.key)) {
    return;
  }
  providers.push(provider);
}

export function getRegisteredCalendarEventProviders(): CalendarEventProvider[] {
  return providers;
}
