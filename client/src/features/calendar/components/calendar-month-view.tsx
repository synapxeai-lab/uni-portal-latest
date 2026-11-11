import Link from "@/components/ui/link";

import { cn } from "@/lib/utils";

import { CalendarEventChip } from "./calendar-event-chip";
import {
  buildCalendarHref,
  getEventsForDay,
  getMonthGridDays,
  groupEventsByDay,
  isToday,
  type CalendarHrefFilters,
} from "../lib/calendar-date";
import { formatDayNumber, formatDayTitle, formatWeekdayShort } from "../lib/calendar-format";
import type { CalendarEvent } from "../types";

const MAX_VISIBLE_EVENTS_PER_DAY = 3;

interface CalendarMonthViewProps {
  date: Date;
  events: CalendarEvent[];
  filters?: CalendarHrefFilters;
}

export function CalendarMonthView({ date, events, filters }: CalendarMonthViewProps) {
  const days = getMonthGridDays(date);
  const weekdayLabels = days.slice(0, 7).map((day) => formatWeekdayShort(day));
  const eventsByDay = groupEventsByDay(events);

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      role="grid"
      aria-label="Month"
    >
      <div className="grid grid-cols-7 border-b border-border bg-muted/40" role="row">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="px-1 py-2.5 text-center text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(eventsByDay, day);
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
          const overflowCount = dayEvents.length - visibleEvents.length;
          const inCurrentMonth = day.getMonth() === date.getMonth();
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              className={cn(
                "flex min-h-[96px] min-w-0 flex-col gap-1.5 border-b border-r border-border p-1 sm:min-h-[128px] sm:p-2 xl:p-2.5",
                !inCurrentMonth && "bg-muted/20",
              )}
            >
              <Link
                href={buildCalendarHref("day", day, filters)}
                aria-label={`${formatDayTitle(day)}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ""}`}
                aria-current={today ? "date" : undefined}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center self-end rounded-full text-xs font-medium transition-colors sm:h-7 sm:w-7",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  today
                    ? "bg-gold font-semibold text-gold-foreground"
                    : inCurrentMonth
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:bg-accent",
                )}
              >
                {formatDayNumber(day)}
              </Link>
              <div className="flex flex-col gap-1">
                {visibleEvents.map((event) => (
                  <CalendarEventChip key={event.id} event={event} />
                ))}
                {overflowCount > 0 ? (
                  <Link
                    href={buildCalendarHref("day", day, filters)}
                    className="rounded px-1 text-left text-[11px] font-medium sm:text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    +{overflowCount} more
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
