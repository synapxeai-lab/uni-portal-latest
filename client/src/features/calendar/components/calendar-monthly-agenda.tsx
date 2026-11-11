import { CalendarEventRow } from "./calendar-event-row";
import { groupEventsByDay } from "../lib/calendar-date";
import { formatAgendaDayLabel } from "../lib/calendar-format";
import type { CalendarEvent } from "../types";

interface CalendarMonthlyAgendaProps {
  monthLabel: string;
  events: CalendarEvent[];
}

/** Flat, chronological alternative to the month grid - every event in the browsed month, grouped by day. */
export function CalendarMonthlyAgenda({ monthLabel, events }: CalendarMonthlyAgendaProps) {
  // Map preserves insertion order, and `events` is always pre-sorted
  // ascending by start time (calendarService.getEvents), so iterating these
  // groups in insertion order is already chronological.
  const groups = groupEventsByDay(events);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">{monthLabel} agenda</h3>
      {groups.size === 0 ? (
        <p className="text-xs text-muted-foreground">No events this month.</p>
      ) : (
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto pr-1">
          {Array.from(groups.values()).map((dayEvents) => (
            <div key={dayEvents[0].id} className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatAgendaDayLabel(dayEvents[0].start)}
              </span>
              {dayEvents.map((event) => (
                <CalendarEventRow key={event.id} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
