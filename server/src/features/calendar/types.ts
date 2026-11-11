export type CalendarViewMode = "month" | "week" | "day";

export const CALENDAR_VIEW_MODES: CalendarViewMode[] = ["month", "week", "day"];

/**
 * Every kind of content the calendar shows (Phase 16.2 - see
 * services/providers/ for what actually produces each type). Kept granular
 * per source rather than one generic "scheduled content" bucket, since the
 * event-type filter (see calendar-filter-bar.tsx) needs to distinguish them.
 */
export type CalendarEventType =
  | "assignment-due"
  | "assignment-scheduled"
  | "announcement-scheduled"
  | "material-scheduled"
  | "classroom";

export const CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  "assignment-due",
  "assignment-scheduled",
  "announcement-scheduled",
  "material-scheduled",
  "classroom",
];

/** One matched item, normalized to a common shape regardless of which module produced it. */
export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  /** Rendered in local time throughout - see lib/calendar-date.ts and lib/calendar-format.ts. */
  start: Date;
  end: Date | null;
  /** True for date-only events (e.g. "classroom archived on this day") with no meaningful time-of-day. */
  allDay: boolean;
  href: string | null;
  classroomId: string | null;
  classroomTitle: string | null;
  description: string | null;
  /**
   * Phase 16.4 - reserved for future recurring-event support (e.g. "every
   * Monday until the semester ends"). An RFC 5545 RRULE string, the same
   * representation ICS/Google Calendar/Outlook all use, so a future
   * recurring-event provider (internal or an external ICS/Google/Outlook
   * sync) can populate it without a shape change. No current provider sets
   * this - every event today is a single, non-repeating instance.
   */
  recurrenceRule?: string | null;
  /** Groups the individual instances of one recurring event together (e.g. so "edit this event" vs "edit the series" can be offered later). Unset until a provider actually produces recurring instances. */
  seriesId?: string | null;
}

export interface CalendarRange {
  start: Date;
  end: Date;
}

export interface CalendarFilters {
  range: CalendarRange;
  classroomId?: string;
  eventTypes?: CalendarEventType[];
}
