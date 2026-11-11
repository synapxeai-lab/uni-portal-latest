import type { CalendarViewMode } from "../types";

export const DEFAULT_CALENDAR_VIEW: CalendarViewMode = "month";

/** Sunday-start weeks, matching the toLocaleDateString-driven weekday labels used throughout this feature. */
export const WEEK_STARTS_ON = 0;

export const CALENDAR_VIEW_LABEL: Record<CalendarViewMode, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
};
