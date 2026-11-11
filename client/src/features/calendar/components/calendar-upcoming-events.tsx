import { CalendarEventRow } from "./calendar-event-row";
import type { CalendarEvent } from "../types";

export function CalendarUpcomingEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">Upcoming</h3>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing coming up in the next two weeks.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <CalendarEventRow key={event.id} event={event} showDate />
          ))}
        </div>
      )}
    </div>
  );
}
