import { cn } from "@/lib/utils";

import { useCalendarEventDialog } from "../context/calendar-event-dialog-context";
import { CALENDAR_EVENT_TYPE_COLOR, CALENDAR_EVENT_TYPE_LABEL } from "../lib/calendar-display";
import { formatEventTime } from "../lib/calendar-format";
import type { CalendarEvent } from "../types";

/** Compact chip for a month-view day cell - reused by nothing else, unlike CalendarEventRow which the week/day views share. Clicking it opens CalendarEventDetailsDialog rather than navigating directly. */
export function CalendarEventChip({ event }: { event: CalendarEvent }) {
  const { openEvent } = useCalendarEventDialog();

  // The chip itself distinguishes types by color alone (there's no room for
  // a text label at this size) - the accessible name makes the type explicit
  // for screen reader users instead of relying on color, and the details
  // dialog (opened on click) always shows the type as visible text too.
  const accessibleName = `${CALENDAR_EVENT_TYPE_LABEL[event.type]}: ${event.title}${
    event.allDay ? "" : `, ${formatEventTime(event.start)}`
  }`;

  return (
    <button
      type="button"
      onClick={() => openEvent(event)}
      aria-label={accessibleName}
      className={cn(
        "block w-full truncate rounded-md border px-1 py-0.5 text-left text-[11px] font-medium leading-snug transition-opacity hover:opacity-80 sm:px-1.5 sm:py-1 sm:text-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        CALENDAR_EVENT_TYPE_COLOR[event.type],
      )}
    >
      {!event.allDay ? (
        <span className="mr-1 hidden opacity-80 sm:inline">{formatEventTime(event.start)}</span>
      ) : null}
      {event.title}
    </button>
  );
}
