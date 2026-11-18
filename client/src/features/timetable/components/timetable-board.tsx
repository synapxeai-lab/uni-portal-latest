import { CalendarPlus, Hourglass, Pencil, Plus, Trash2 } from "lucide-react";
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
import { SLOT_START_HOURS, TIMETABLE_DAYS, formatSlot } from "../lib/slots";
import type { TimetableClassroomOption, TimetableSlotView } from "../types";
import { ScheduleSlotDialog, type SlotPrefill } from "./schedule-slot-dialog";

interface TimetableBoardProps {
  /** Every class on the shared institute timetable. */
  slots: TimetableSlotView[];
  /** Classes the viewer can schedule. Empty/omitted for students and admins (view-only). */
  schedulableClassrooms?: TimetableClassroomOption[];
  canSchedule: boolean;
  /** Registered room numbers: one row per room in every day's grid. */
  rooms: string[];
  /** Today's weekday (1 = Monday .. 6 = Saturday), or null on Sunday - for highlighting. */
  today: number | null;
  /** Whether the "My classes" highlight toggle applies (teachers and students). */
  hasOwnClasses: boolean;
}

type DialogState = { kind: "create"; prefill?: SlotPrefill } | { kind: "reschedule"; slot: TimetableSlotView } | null;

/** "8 AM", "12 PM", "1 PM" - 12-hour column headers. */
const shortHour = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 && hour < 24 ? "PM" : "AM"}`;

/** Rooms sorted by number (floor first), including any a class is booked in. */
function roomRows(rooms: string[], slots: TimetableSlotView[]) {
  return [...new Set([...rooms, ...slots.map((s) => s.room)])].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/**
 * The shared weekly timetable: one grid per day (Monday-Saturday) stacked down
 * the page, rooms down the side and one-hour slots across. Every class is on
 * it, so anyone can see which rooms are free at a given hour; the viewer's own
 * classes are highlighted, and only a class's teacher (or an admin) can change it.
 */
export function TimetableBoard({
  slots,
  schedulableClassrooms = [],
  canSchedule,
  rooms,
  today,
  hasOwnClasses,
}: TimetableBoardProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [details, setDetails] = useState<TimetableSlotView | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TimetableSlotView | null>(null);
  const [isCancelling, startCancel] = useTransition();
  const [mineOnly, setMineOnly] = useState(false);
  // One day at a time: today's tab first (Monday on a Sunday).
  const [activeDay, setActiveDay] = useState<number>(today ?? 1);

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

  const rows = useMemo(() => roomRows(rooms, slots), [rooms, slots]);
  // day -> "room|hour" -> slots (normally one: a room holds one class an hour).
  const byCell = useMemo(() => {
    const map = new Map<string, TimetableSlotView[]>();
    for (const slot of slots) {
      const key = `${slot.dayOfWeek}|${slot.room}|${slot.startHour}`;
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots]);
  const myCount = slots.filter((s) => s.isMine).length;

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

  const canBook = canSchedule && schedulableClassrooms.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {slots.length === 0
            ? "Nothing on the timetable yet."
            : `${slots.length} ${slots.length === 1 ? "class" : "classes"} every week across ${rows.length} ${rows.length === 1 ? "room" : "rooms"}${hasOwnClasses ? ` · ${myCount} of them yours` : ""}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hasOwnClasses ? (
            <div className="flex items-center rounded-full border border-border p-0.5" role="group" aria-label="Show">
              {(
                [
                  { value: false, label: "All classes" },
                  { value: true, label: "My classes" },
                ] as const
              ).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={mineOnly === option.value}
                  onClick={() => setMineOnly(option.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    mineOnly === option.value
                      ? "bg-gold font-semibold text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          {canSchedule ? (
            <Button onClick={() => setDialog({ kind: "create" })} disabled={!canBook}>
              <CalendarPlus aria-hidden /> Add a class
            </Button>
          ) : null}
        </div>
      </div>
      {canSchedule && !canBook ? (
        <p className="text-xs text-muted-foreground">
          You need an active class with a section before you can add it to the timetable.
        </p>
      ) : null}

      {/* Day tabs: one day's grid at a time. */}
      <div role="tablist" aria-label="Day" className="flex flex-wrap gap-2">
        {TIMETABLE_DAYS.map((day) => {
          const count = slots.filter((s) => s.dayOfWeek === day.value).length;
          const selected = day.value === activeDay;
          return (
            <button
              key={day.value}
              type="button"
              role="tab"
              id={`timetable-tab-${day.value}`}
              aria-selected={selected}
              aria-controls="timetable-day-panel"
              onClick={() => setActiveDay(day.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "border-gold bg-gold font-semibold text-white"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {day.label}
              {day.value === today ? <span className={cn("text-xs", selected ? "text-white/80" : "")}>· today</span> : null}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-5",
                  selected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No rooms are registered yet, so there's nothing to show. An admin adds rooms first.
        </Card>
      ) : (
        TIMETABLE_DAYS.filter((day) => day.value === activeDay).map((day) => {
          const dayCount = slots.filter((s) => s.dayOfWeek === day.value).length;
          const isToday = day.value === today;
          return (
            <section
              key={day.value}
              id="timetable-day-panel"
              role="tabpanel"
              aria-labelledby={`timetable-tab-${day.value}`}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {day.label}
                </h2>
                {isToday ? <Badge>Today</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  {dayCount} {dayCount === 1 ? "class" : "classes"}
                </span>
              </div>

              <div
                className={cn(
                  "overflow-x-auto rounded-xl border border-border bg-card",
                  isToday && "border-primary/60 ring-1 ring-primary/30",
                )}
              >
                <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 z-10 w-16 border-b border-r border-border bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Room
                      </th>
                      {SLOT_START_HOURS.map((hour) => (
                        <th
                          key={hour}
                          scope="col"
                          className="border-b border-l border-border px-2 py-2 text-left text-xs font-semibold text-foreground"
                        >
                          {shortHour(hour)}
                          <span className="font-normal text-muted-foreground"> – {shortHour(hour + 1)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((room) => (
                      <tr key={room}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-2 text-left text-xs font-semibold text-foreground"
                        >
                          {room}
                        </th>
                        {SLOT_START_HOURS.map((hour) => {
                          const here = byCell.get(`${day.value}|${room}|${hour}`) ?? [];
                          return (
                            <td key={hour} className="h-16 border-b border-l border-border p-1 align-top">
                              {here.length > 0 ? (
                                <div className="flex h-full flex-col gap-1">
                                  {here.map((slot) => {
                                    const dimmed = mineOnly && !slot.isMine;
                                    return (
                                      <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => setDetails(slot)}
                                        title={`${slot.classroomTitle} · Sec ${slot.section} · ${slot.teacherName}`}
                                        className={cn(
                                          "flex min-h-0 w-full flex-1 flex-col items-start gap-0.5 rounded-md border border-l-4 px-1.5 py-1 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                          colorOf(slot).surface,
                                          colorOf(slot).accent,
                                          slot.isMine && "ring-2 ring-gold",
                                          slot.pendingMove && "border-dashed",
                                          dimmed && "opacity-35",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "flex w-full items-center gap-1 text-[11px] font-semibold leading-tight",
                                            colorOf(slot).title,
                                          )}
                                        >
                                          {slot.pendingMove ? (
                                            <Hourglass className="h-3 w-3 shrink-0 text-amber-600" aria-hidden />
                                          ) : null}
                                          <span className="line-clamp-1">{slot.classroomTitle}</span>
                                        </span>
                                        <span className="line-clamp-1 text-[10px] text-muted-foreground">
                                          Sec {slot.section} · {slot.teacherName}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : canBook ? (
                                <button
                                  type="button"
                                  aria-label={`Book Room ${room}, ${day.label} ${shortHour(hour)}`}
                                  onClick={() =>
                                    setDialog({
                                      kind: "create",
                                      prefill: { dayOfWeek: day.value, startHour: hour, room },
                                    })
                                  }
                                  className="flex h-full w-full items-center justify-center rounded-md text-muted-foreground/0 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Plus className="h-4 w-4" aria-hidden />
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
            </section>
          );
        })
      )}

      {/* Class details */}
      {details ? (
        <Dialog open onOpenChange={(open) => !open && setDetails(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={cn("h-3 w-3 shrink-0 rounded-full", colorOf(details).dot)} aria-hidden />
                {details.classroomTitle}
                {details.isMine ? <Badge variant="secondary">Yours</Badge> : null}
              </DialogTitle>
              <DialogDescription>Every week - this is part of the weekly timetable.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-foreground">{formatSlot(details.dayOfWeek, details.startHour)}</dd>
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
          prefill={dialog.prefill}
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
