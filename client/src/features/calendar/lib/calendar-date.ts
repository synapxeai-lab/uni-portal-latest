import { WEEK_STARTS_ON } from "./calendar-constants";
import type { CalendarEvent, CalendarEventType, CalendarRange, CalendarViewMode } from "../types";

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

/** Clamps to the last valid day of the target month (e.g. Jan 31 + 1 month lands on Feb 28/29, not rolls into March). */
export function addMonths(date: Date, amount: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const diff = (result.getDay() - WEEK_STARTS_ON + 7) % 7;
  result.setDate(result.getDate() - diff);
  return result;
}

export function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

export function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** The full 6-week (42-day) grid a month view renders, including leading/trailing days from adjacent months. */
export function getMonthGridDays(date: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * Buckets events by local calendar day in one O(n) pass, keyed by the same
 * `YYYY-MM-DD` format formatDateParam uses. Every grid/list view (month,
 * week, day, the monthly agenda) shares this instead of each running its own
 * `events.filter(isSameDay(...))` per day - fewer full-list scans, and one
 * shared, always-consistent definition of "which day does this event belong
 * to" across the whole feature.
 */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = formatDateParam(event.start);
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }
  return groups;
}

export function getEventsForDay(
  groupedEvents: Map<string, CalendarEvent[]>,
  day: Date,
): CalendarEvent[] {
  return groupedEvents.get(formatDateParam(day)) ?? [];
}

/** The date range a view needs to fetch events for - widened to the full visible grid for month view. */
export function getRangeForView(date: Date, view: CalendarViewMode): CalendarRange {
  switch (view) {
    case "month": {
      const days = getMonthGridDays(date);
      return { start: startOfDay(days[0]), end: endOfDay(days[days.length - 1]) };
    }
    case "week":
      return { start: startOfWeek(date), end: endOfWeek(date) };
    case "day":
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}

/** Prev/Next navigation - moves by one unit of whichever view is currently active. */
export function navigateDate(date: Date, view: CalendarViewMode, direction: 1 | -1): Date {
  switch (view) {
    case "month":
      return addMonths(date, direction);
    case "week":
      return addDays(date, direction * 7);
    case "day":
    default:
      return addDays(date, direction);
  }
}

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses the `?date=YYYY-MM-DD` URL param as a local date (never UTC - avoids the classic off-by-one-day bug). Falls back to today for a missing/invalid value. */
export function parseDateParam(value: string | undefined): Date {
  if (value && DATE_PARAM_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfDay(parsed);
    }
  }
  return startOfDay(new Date());
}

export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface CalendarHrefFilters {
  classroomId?: string;
  eventTypes?: CalendarEventType[];
}

/**
 * Every navigation link on the page (Prev/Next/Today, the view switcher, a
 * month cell's day number, ...) routes through this so an active
 * classroom/event-type filter is never silently dropped by clicking around.
 */
export function buildCalendarHref(
  view: CalendarViewMode,
  date: Date,
  filters?: CalendarHrefFilters,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("date", formatDateParam(date));
  if (filters?.classroomId) {
    params.set("classroomId", filters.classroomId);
  }
  if (filters?.eventTypes && filters.eventTypes.length > 0) {
    params.set("types", filters.eventTypes.join(","));
  }
  return `/calendar?${params.toString()}`;
}
