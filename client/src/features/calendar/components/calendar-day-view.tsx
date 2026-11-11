import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

import { CalendarEventRow } from "./calendar-event-row";
import { getEventsForDay, groupEventsByDay } from "../lib/calendar-date";
import type { CalendarEvent } from "../types";

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
}

export function CalendarDayView({ date, events }: CalendarDayViewProps) {
  const dayEvents = getEventsForDay(groupEventsByDay(events), date);
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);

  if (dayEvents.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled"
        description="Events for this day will show up here once they're added."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      {allDayEvents.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All day
          </h3>
          {allDayEvents.map((event) => (
            <CalendarEventRow key={event.id} event={event} />
          ))}
        </div>
      ) : null}
      {timedEvents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {allDayEvents.length > 0 ? (
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Schedule
            </h3>
          ) : null}
          {timedEvents.map((event) => (
            <CalendarEventRow key={event.id} event={event} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
