import { parseDateParam } from "./calendar-date";
import { CALENDAR_EVENT_TYPES, CALENDAR_VIEW_MODES } from "../types";
import type { CalendarEventType, CalendarViewMode } from "../types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function getStringParam(searchParams: RawSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseView(value: string | undefined): CalendarViewMode {
  return CALENDAR_VIEW_MODES.includes(value as CalendarViewMode)
    ? (value as CalendarViewMode)
    : "month";
}

/** `?types=` is a comma-separated list - anything unrecognized is silently dropped rather than erroring. */
export function parseEventTypes(value: string | undefined): CalendarEventType[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is CalendarEventType =>
      CALENDAR_EVENT_TYPES.includes(entry as CalendarEventType),
    );
}

export interface ParsedCalendarParams {
  view: CalendarViewMode;
  date: Date;
  classroomId?: string;
  eventTypes: CalendarEventType[];
}

export function parseCalendarParams(searchParams: RawSearchParams): ParsedCalendarParams {
  return {
    view: parseView(getStringParam(searchParams, "view")),
    date: parseDateParam(getStringParam(searchParams, "date")),
    classroomId: getStringParam(searchParams, "classroomId"),
    eventTypes: parseEventTypes(getStringParam(searchParams, "types")),
  };
}
