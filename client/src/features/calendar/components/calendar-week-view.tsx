import Link from "@/components/ui/link";

import { cn } from "@/lib/utils";

import { CalendarEventRow } from "./calendar-event-row";
import {
  buildCalendarHref,
  getEventsForDay,
  getWeekDays,
  groupEventsByDay,
  isToday,
  type CalendarHrefFilters,
} from "../lib/calendar-date";
import { formatDayNumber, formatDayTitle, formatWeekdayShort } from "../lib/calendar-format";
import type { CalendarEvent } from "../types";

// Caps a single busy day at a fixed number of visible rows instead of
// letting it grow unbounded and stretch the whole week's row height on every
// screen size - same overflow pattern CalendarMonthView already uses, now
// applied consistently across both grid views.
const MAX_VISIBLE_EVENTS_PER_DAY = 4;

interface CalendarWeekViewProps {
  date: Date;
  events: CalendarEvent[];
  filters?: CalendarHrefFilters;
}

export function CalendarWeekView({ date, events, filters }: CalendarWeekViewProps) {
  const days = getWeekDays(date);
  const eventsByDay = groupEventsByDay(events);

  return (
    // 7 across only once the content area is wide enough for readable
    // columns (the app sidebar takes 300px); a day list below that.
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 xl:gap-2.5">
      {days.map((day) => {
        const dayEvents = getEventsForDay(eventsByDay, day);
        const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
        const overflowCount = dayEvents.length - visibleEvents.length;
        const today = isToday(day);

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3 xl:p-2.5",
              today && "border-gold/60",
            )}
          >
            <Link
              href={buildCalendarHref("day", day, filters)}
              aria-label={`${formatDayTitle(day)}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              aria-current={today ? "date" : undefined}
              className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:flex-col xl:items-center xl:gap-1"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatWeekdayShort(day)}
              </span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                  today ? "bg-gold font-semibold text-gold-foreground" : "text-foreground",
                )}
              >
                {formatDayNumber(day)}
              </span>
            </Link>
            <div className="flex flex-col gap-2">
              {dayEvents.length === 0 ? (
                <p className="px-1.5 pb-1 text-xs text-muted-foreground">No events</p>
              ) : (
                <>
                  {visibleEvents.map((event) => (
                    <CalendarEventRow key={event.id} event={event} stacked />
                  ))}
                  {overflowCount > 0 ? (
                    <Link
                      href={buildCalendarHref("day", day, filters)}
                      className="rounded px-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      +{overflowCount} more
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
