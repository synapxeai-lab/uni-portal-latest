import {
  CalendarPlus,
  Clock,
  DoorOpen,
  Hourglass,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { cancelSlotAction } from "../api";
import { assignCourseColors, courseColorFor } from "../lib/course-colors";
import { SLOT_START_HOURS, TIMETABLE_DAYS, formatHourRange, formatSlot } from "../lib/slots";
import type { TimetableClassroomOption, TimetableSlotView } from "../types";
import { ScheduleSlotDialog } from "./schedule-slot-dialog";

interface TimetableBoardProps {
  /** The viewer's whole weekly timetable. */
  slots: TimetableSlotView[];
  /** Classes the viewer can schedule. Empty/omitted for students (view-only). */
  schedulableClassrooms?: TimetableClassroomOption[];
  canSchedule: boolean;
  /** Whether to show who teaches each class (students/admins see it; a teacher's own timetable doesn't need it). */
  showTeacher: boolean;
  /** Registered room numbers, for the room picker. */
  rooms: string[];
  /** Today's weekday (1 = Monday .. 6 = Saturday), or null on Sunday - for highlighting. */
  today: number | null;
}

type DialogState = { kind: "create" } | { kind: "reschedule"; slot: TimetableSlotView } | null;
type View = "grid" | "days";

/** The weekly timetable template - the same every week until it's changed. */
export function TimetableBoard({
  slots,
  schedulableClassrooms = [],
  canSchedule,
  showTeacher,
  rooms,
  today,
}: TimetableBoardProps) {
  const [view, setView] = useState<View>("grid");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [details, setDetails] = useState<TimetableSlotView | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TimetableSlotView | null>(null);
  const [isCancelling, startCancel] = useTransition();

  function confirmCancel() {
    if (!cancelTarget) {
      return;
    }
    const target = cancelTarget;

    startCancel(async () => {
      const result = await cancelSlotAction(target.id);
      if (result.status === "success") {
        toast.success(
          `${target.classroomTitle} (${formatSlot(target.dayOfWeek, target.startHour)}) removed from the timetable.`,
        );
        setCancelTarget(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  const courseColors = useMemo(() => assignCourseColors(slots), [slots]);
  const colorOf = (slot: Pick<TimetableSlotView, "classroomId">) =>
    courseColors.get(slot.classroomId) ?? courseColorFor(slot.classroomId);
  const legend = useMemo(() => {
    const seen = new Map<string, TimetableSlotView>();
    for (const slot of slots) {
      if (!seen.has(slot.classroomId)) {
        seen.set(slot.classroomId, slot);
      }
    }
    return [...seen.values()].sort((a, b) => a.classroomTitle.localeCompare(b.classroomTitle));
  }, [slots]);

  const slotAt = (day: number, hour: number) =>
    slots.find((slot) => slot.dayOfWeek === day && slot.startHour === hour);

  const actions = (slot: TimetableSlotView, onDone?: () => void) =>
    slot.canManage ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={Boolean(slot.pendingMove)}
          onClick={() => {
            onDone?.();
            setDialog({ kind: "reschedule", slot });
          }}
        >
          <Pencil aria-hidden /> Change
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onDone?.();
            setCancelTarget(slot);
          }}
        >
          <Trash2 aria-hidden /> Remove
        </Button>
      </div>
    ) : null;

  const pendingNote = (slot: TimetableSlotView) =>
    slot.pendingMove ? (
      <p className="flex items-start gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-foreground">
        <Hourglass className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Move to {formatSlot(slot.pendingMove.dayOfWeek, slot.pendingMove.startHour)} (Room{" "}
        {slot.pendingMove.room}) is waiting for the admin.
      </p>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {slots.length === 0
            ? "Nothing on the timetable yet."
            : `${slots.length} ${slots.length === 1 ? "class" : "classes"} every week.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="hidden items-center rounded-full border border-border p-0.5 lg:flex"
            role="tablist"
            aria-label="Timetable view"
          >
            {(
              [
                { value: "grid", label: "Timetable", icon: LayoutGrid },
                { value: "days", label: "By day", icon: List },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={view === option.value}
                onClick={() => setView(option.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  view === option.value
                    ? "bg-gold font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="h-3.5 w-3.5" aria-hidden /> {option.label}
              </button>
            ))}
          </div>
          {canSchedule ? (
            <Button
              onClick={() => setDialog({ kind: "create" })}
              disabled={schedulableClassrooms.length === 0}
            >
              <CalendarPlus aria-hidden /> Add a class
            </Button>
          ) : null}
        </div>
      </div>
      {canSchedule && schedulableClassrooms.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          You need an active class with a section before you can add it to the timetable.
        </p>
      ) : null}

      {legend.length > 1 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Courses">
          {legend.map((course) => (
            <li
              key={course.classroomId}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", colorOf(course).dot)} aria-hidden />
              {course.classroomTitle}
              <span className="text-muted-foreground/70">· Sec {course.section}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Grid: hours down the side, Monday-Saturday across (wide screens only). */}
      <div
        className={cn(
          "hidden overflow-x-auto rounded-xl border border-border bg-card",
          view === "grid" && "lg:block",
        )}
      >
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-32 border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Time
              </th>
              {TIMETABLE_DAYS.map((day) => (
                <th
                  key={day.value}
                  scope="col"
                  className={cn(
                    "border-b border-l border-border px-3 py-2 text-left text-xs font-semibold text-foreground",
                    day.value === today && "bg-primary/10",
                  )}
                >
                  {day.label}
                  {day.value === today ? (
                    <span className="ml-1 font-normal text-muted-foreground">(today)</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOT_START_HOURS.map((hour) => (
              <tr key={hour}>
                <th
                  scope="row"
                  className="border-b border-border px-3 py-2 text-left align-top text-xs font-medium text-muted-foreground"
                >
                  {formatHourRange(hour)}
                </th>
                {TIMETABLE_DAYS.map((day) => {
                  const slot = slotAt(day.value, hour);
                  return (
                    <td
                      key={day.value}
                      className={cn(
                        "h-16 border-b border-l border-border p-1 align-top",
                        day.value === today && "bg-primary/5",
                      )}
                    >
                      {slot ? (
                        <button
                          type="button"
                          onClick={() => setDetails(slot)}
                          className={cn(
                            "flex h-full w-full flex-col items-start gap-0.5 rounded-md border border-l-4 px-2 py-1 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            colorOf(slot).surface,
                            colorOf(slot).accent,
                            slot.pendingMove && "border-dashed",
                          )}
                        >
                          <span
                            className={cn(
                              "flex w-full items-center gap-1 text-xs font-semibold",
                              colorOf(slot).title,
                            )}
                          >
                            {slot.pendingMove ? (
                              <Hourglass className="h-3 w-3 shrink-0 text-amber-600" aria-hidden />
                            ) : null}
                            <span className="line-clamp-1">{slot.classroomTitle}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Room {slot.room} · Sec {slot.section}
                          </span>
                          {showTeacher ? (
                            <span className="line-clamp-1 text-[11px] text-muted-foreground">
                              {slot.teacherName}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Day-by-day list (always on small screens; the "By day" view on wide ones). */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3",
          view === "grid" && "lg:hidden",
        )}
      >
        {TIMETABLE_DAYS.map((day) => {
          const daySlots = slots.filter((slot) => slot.dayOfWeek === day.value);
          const isToday = day.value === today;
          return (
            <Card
              key={day.value}
              className={cn(
                "flex flex-col gap-3 p-4",
                isToday && "border-primary/60 ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{day.label}</h2>
                <div className="flex items-center gap-2">
                  {isToday ? <Badge>Today</Badge> : null}
                  <span className="text-xs text-muted-foreground">
                    {daySlots.length} {daySlots.length === 1 ? "class" : "classes"}
                  </span>
                </div>
              </div>

              {daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {daySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-lg border border-l-4 p-3",
                        colorOf(slot).surface,
                        colorOf(slot).accent,
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {formatHourRange(slot.startHour)}
                        </span>
                        <span className="flex items-center gap-1">
                          <DoorOpen className="h-3.5 w-3.5" aria-hidden />
                          Room {slot.room}
                        </span>
                      </div>
                      <p className={cn("text-sm font-semibold", colorOf(slot).title)}>
                        {slot.classroomTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Section {slot.section}
                        {slot.subject ? ` · ${slot.subject}` : ""}
                        {showTeacher ? ` · ${slot.teacherName}` : ""}
                      </p>
                      {pendingNote(slot)}
                      {slot.canManage ? <div className="pt-1">{actions(slot)}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>

      {/* Grid cell details */}
      {details ? (
        <Dialog open onOpenChange={(open) => !open && setDetails(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span
                  className={cn("h-3 w-3 shrink-0 rounded-full", colorOf(details).dot)}
                  aria-hidden
                />
                {details.classroomTitle}
              </DialogTitle>
              <DialogDescription>
                Every week - this is part of the weekly timetable.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-foreground">
                {formatSlot(details.dayOfWeek, details.startHour)}
              </dd>
              <dt className="text-muted-foreground">Room</dt>
              <dd className="text-foreground">{details.room}</dd>
              <dt className="text-muted-foreground">Section</dt>
              <dd className="text-foreground">{details.section}</dd>
              {details.subject ? (
                <>
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="text-foreground">{details.subject}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Teacher</dt>
              <dd className="text-foreground">{details.teacherName}</dd>
            </dl>
            {pendingNote(details)}
            {details.canManage ? (
              <DialogFooter>{actions(details, () => setDetails(null))}</DialogFooter>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog?.kind === "create" ? (
        <ScheduleSlotDialog
          mode="create"
          classrooms={schedulableClassrooms}
          rooms={rooms}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "reschedule" ? (
        <ScheduleSlotDialog
          mode="reschedule"
          slot={dialog.slot}
          rooms={rooms}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Remove this class from the timetable?"
        description={
          cancelTarget
            ? `${cancelTarget.classroomTitle} (${formatSlot(cancelTarget.dayOfWeek, cancelTarget.startHour)}, Room ${cancelTarget.room}) will no longer be on the weekly timetable. Its students will be notified.`
            : ""
        }
        confirmLabel="Remove class"
        destructive
        pending={isCancelling}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
