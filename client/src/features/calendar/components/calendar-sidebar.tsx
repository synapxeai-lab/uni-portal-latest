import { CalendarMonthlyAgenda } from "./calendar-monthly-agenda";
import { CalendarTodayEvents } from "./calendar-today-events";
import { CalendarUpcomingEvents } from "./calendar-upcoming-events";
import type { CalendarEvent } from "../types";

interface CalendarSidebarProps {
  todayEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  monthEvents: CalendarEvent[];
  monthLabel: string;
}

/** Today / Upcoming / Monthly agenda - independent of whichever grid view (Month/Week/Day) is active, and of the browsed date except for the agenda, which follows the browsed month. */
export function CalendarSidebar({
  todayEvents,
  upcomingEvents,
  monthEvents,
  monthLabel,
}: CalendarSidebarProps) {
  return (
    // Below the grid: side-by-side cards. Beside the grid (2xl): one column.
    <aside className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:w-80 2xl:shrink-0 2xl:grid-cols-1">
      <CalendarTodayEvents events={todayEvents} />
      <CalendarUpcomingEvents events={upcomingEvents} />
      <CalendarMonthlyAgenda monthLabel={monthLabel} events={monthEvents} />
    </aside>
  );
}
