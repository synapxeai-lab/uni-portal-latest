import { CalendarEventRow } from "./calendar-event-row";
import type { CalendarEvent } from "../types";

export function CalendarTodayEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">Today</h3>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events today.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <CalendarEventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
