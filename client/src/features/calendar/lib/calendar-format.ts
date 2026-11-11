import type { CalendarRange, CalendarViewMode } from "../types";

export function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatWeekRangeTitle(range: CalendarRange): string {
  const sameMonth =
    range.start.getMonth() === range.end.getMonth() &&
    range.start.getFullYear() === range.end.getFullYear();

  const startLabel = range.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = range.end.toLocaleDateString(
    undefined,
    sameMonth
      ? { day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );

  return `${startLabel} – ${endLabel}`;
}

export function formatDayTitle(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function formatDayNumber(date: Date): string {
  return String(date.getDate());
}

/** Compact "Jul 17" label - used wherever a row needs to show its date, not just its time (Today/Upcoming/Agenda sidebar sections). */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Wed, Jul 17" - the monthly agenda's day-group header, more compact than formatDayTitle since it's already scoped to one month. */
export function formatAgendaDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** The toolbar's current-period heading - what it shows depends on which view is active. */
export function formatToolbarTitle(
  date: Date,
  view: CalendarViewMode,
  range: CalendarRange,
): string {
  switch (view) {
    case "month":
      return formatMonthTitle(date);
    case "week":
      return formatWeekRangeTitle(range);
    case "day":
    default:
      return formatDayTitle(date);
  }
}
