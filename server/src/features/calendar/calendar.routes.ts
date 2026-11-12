import { Router, type Request } from "express";
import { z } from "zod";

import { parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl } from "@/lib/cache/tags";
import { getClassroomSearchScope } from "@/features/classroom/services/classroom-service";

import * as calendarService from "./services/calendar-service";
import { CALENDAR_EVENT_TYPES, type CalendarEventType, type CalendarRange } from "./types";

export const calendarRouter = Router();

const instant = z.string().datetime({ offset: true });

/**
 * The page's four date windows. They are computed in the browser, in the
 * viewer's own time zone ("today", "this month"), and sent as exact instants -
 * the server never guesses a zone.
 */
const calendarQuerySchema = z.object({
  gridStart: instant,
  gridEnd: instant,
  todayStart: instant,
  todayEnd: instant,
  upcomingStart: instant,
  upcomingEnd: instant,
  monthStart: instant,
  monthEnd: instant,
  classroomId: z.string().uuid().optional(),
  types: z.string().optional(),
});

function rangeOf(start: string, end: string): CalendarRange {
  return { start: new Date(start), end: new Date(end) };
}

function parseEventTypes(raw: string | undefined): CalendarEventType[] | undefined {
  const types = (raw ?? "")
    .split(",")
    .filter((value): value is CalendarEventType =>
      CALENDAR_EVENT_TYPES.includes(value as CalendarEventType),
    );
  return types.length > 0 ? types : undefined;
}

function queryOf(req: Request) {
  const query = Object.fromEntries(
    Object.entries(req.query).filter(([, value]) => typeof value === "string" && value !== ""),
  );
  return parseParams(calendarQuerySchema, query, "Invalid calendar range.");
}

/** Everything the Calendar page renders - grid, today, upcoming, month agenda and filters. */
calendarRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const query = queryOf(req);
  const eventTypes = parseEventTypes(query.types);
  const baseFilters = { classroomId: query.classroomId, eventTypes };

  const data = await cached(
    `calendar:${user.id}:${user.role}:${JSON.stringify(query)}`,
    { ttl: CacheTtl.LIVE, tags: [CacheTags.ACADEMIC, CacheTags.AGGREGATES] },
    async () => {
      const scope = await getClassroomSearchScope(user);
      const [[events, todayEvents, upcomingEvents, monthAgendaEvents], filterOptions] =
        await Promise.all([
          calendarService.getEventsForRanges(user, scope, baseFilters, [
            rangeOf(query.gridStart, query.gridEnd),
            rangeOf(query.todayStart, query.todayEnd),
            rangeOf(query.upcomingStart, query.upcomingEnd),
            rangeOf(query.monthStart, query.monthEnd),
          ]),
          calendarService.getFilterOptions(scope),
        ]);
      return { events, todayEvents, upcomingEvents, monthAgendaEvents, filterOptions };
    },
  );

  res.json(data);
});
