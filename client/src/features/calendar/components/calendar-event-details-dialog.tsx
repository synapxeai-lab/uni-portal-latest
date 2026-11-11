import Link from "@/components/ui/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useCalendarEventDialog } from "../context/calendar-event-dialog-context";
import { CALENDAR_EVENT_TYPE_COLOR, CALENDAR_EVENT_TYPE_LABEL } from "../lib/calendar-display";
import { formatDayTitle, formatEventTime } from "../lib/calendar-format";

/**
 * The single dialog every event chip/row across the page opens (see
 * CalendarEventDialogProvider) - shows the event's full details and a "View"
 * action that navigates to its related resource (assignment page, stream,
 * classwork, or classroom), reusing those existing routes rather than
 * building any new detail view.
 */
export function CalendarEventDetailsDialog() {
  const { selectedEvent, closeEvent } = useCalendarEventDialog();

  return (
    <Dialog
      open={selectedEvent !== null}
      onOpenChange={(open) => (!open ? closeEvent() : undefined)}
    >
      <DialogContent className="max-w-md">
        {selectedEvent ? (
          <>
            <DialogHeader>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  CALENDAR_EVENT_TYPE_COLOR[selectedEvent.type],
                )}
              >
                {CALENDAR_EVENT_TYPE_LABEL[selectedEvent.type]}
              </span>
              <DialogTitle>{selectedEvent.title}</DialogTitle>
              <DialogDescription>
                {formatDayTitle(selectedEvent.start)}
                {!selectedEvent.allDay
                  ? ` · ${formatEventTime(selectedEvent.start)}`
                  : " · All day"}
              </DialogDescription>
            </DialogHeader>
            {selectedEvent.classroomTitle || selectedEvent.description ? (
              <div className="flex flex-col gap-1 text-sm">
                {selectedEvent.classroomTitle ? (
                  <p className="text-muted-foreground">
                    Classroom:{" "}
                    <span className="text-foreground">{selectedEvent.classroomTitle}</span>
                  </p>
                ) : null}
                {selectedEvent.description ? (
                  <p className="text-muted-foreground">{selectedEvent.description}</p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={closeEvent}>
                Close
              </Button>
              {selectedEvent.href ? (
                <Button asChild onClick={closeEvent}>
                  <Link href={selectedEvent.href}>View</Link>
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
