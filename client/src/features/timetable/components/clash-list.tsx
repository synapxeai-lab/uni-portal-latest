import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/states/empty-state";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { dismissClashAction, resolveClashAction } from "../api";
import { getClashAvailabilityAction } from "../api";
import {
  ROOM_FORMAT_MESSAGE,
  formatShortDate,
  formatSlot,
  isValidRoom,
  sanitizeRoomInput,
} from "../lib/slots";
import type { TimetableClashView } from "../types";
import { DayPicker } from "./day-picker";
import { SlotPicker } from "./slot-picker";
import { RoomOccupancy, applyRoomToAvailability } from "./room-occupancy";
import { useSlotAvailability } from "./use-slot-availability";

function ResolveClashDialog({
  clash,
  rooms,
  onOpenChange,
}: {
  clash: TimetableClashView;
  rooms: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(clash.dayOfWeek);
  const [room, setRoom] = useState(clash.room);
  const [hour, setHour] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const roomIsValid = isValidRoom(room) && rooms.includes(room);
  const availability = useSlotAvailability(`${clash.id}|${dayOfWeek}`, () =>
    getClashAvailabilityAction({ clashId: clash.id, dayOfWeek }),
  );
  // The typed room is checked against each hour's booked rooms locally - no refetch per keystroke.
  const hours = applyRoomToAvailability(availability.hours, room);
  const selectedSlot = hours?.find((slot) => slot.hour === hour);
  const canSubmit = roomIsValid && selectedSlot?.state === "free";

  function submit() {
    if (hour === null || !roomIsValid) {
      return;
    }

    startTransition(async () => {
      const result = await resolveClashAction({
        clashId: clash.id,
        dayOfWeek,
        startHour: hour,
        room,
      });
      if (result.status === "success") {
        toast.success(
          `${clash.classroomTitle} moved to ${formatSlot(dayOfWeek, hour)} in Room ${room.trim()}. Teachers and students were notified.`,
        );
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resolve clash</DialogTitle>
          <DialogDescription>
            {clash.requestedByName}{" "}
            {clash.currentDayOfWeek !== null && clash.currentStartHour !== null
              ? `wants to move ${clash.classroomTitle} from ${formatSlot(clash.currentDayOfWeek, clash.currentStartHour)} (Room ${clash.currentRoom}) to`
              : `asked for ${clash.classroomTitle} on`}{" "}
            {formatSlot(clash.dayOfWeek, clash.startHour)} (Room {clash.room}), but{" "}
            {clash.kind === "ROOM"
              ? `Room ${clash.room} is already in use by ${clash.conflictingClassroomTitle ?? "another class"}`
              : `Section ${clash.section} already has ${clash.conflictingClassroomTitle ?? "a class"}`}{" "}
            then. Move {clash.classroomTitle} to a free slot and/or room - the existing class keeps
            its slot.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>New day</Label>
            <DayPicker
              value={dayOfWeek}
              onChange={(day) => {
                setDayOfWeek(day);
                setHour(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>New time slot</Label>
            <SlotPicker
              availability={hours}
              loading={availability.loading}
              value={hour}
              onChange={setHour}
              allowTaken={false}
            />
            {availability.error ? (
              <p className="text-xs text-destructive">{availability.error}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clash-room">Room no.</Label>
            <Input
              id="clash-room"
              value={room}
              inputMode="numeric"
              maxLength={3}
              onChange={(event) => setRoom(sanitizeRoomInput(event.target.value))}
            />
            <p
              className={`text-xs ${room !== "" && !roomIsValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {room !== "" && !isValidRoom(room)
                ? ROOM_FORMAT_MESSAGE
                : room !== "" && !roomIsValid
                  ? `Room ${room} isn't a registered room - pick one from the list below.`
                  : "Keep the requested room or pick another free one below - a room holds one class at a time."}
            </p>
            <RoomOccupancy slot={selectedSlot} room={room} rooms={rooms} onSelect={setRoom} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !canSubmit}>
            {isPending ? "Moving…" : "Move class & notify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClashList({
  clashes,
  rooms,
}: {
  clashes: TimetableClashView[];
  /** Registered room numbers, for the resolve dialog's room picker. */
  rooms: string[];
}) {
  const [resolveTarget, setResolveTarget] = useState<TimetableClashView | null>(null);
  const [dismissTarget, setDismissTarget] = useState<TimetableClashView | null>(null);
  const [isDismissing, startDismiss] = useTransition();

  function confirmDismiss() {
    if (!dismissTarget) {
      return;
    }
    const target = dismissTarget;

    startDismiss(async () => {
      const result = await dismissClashAction(target.id);
      if (result.status === "success") {
        toast.success("Clash dismissed.");
        setDismissTarget(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (clashes.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No clashes"
        description="Nothing needs your attention. Clashes show up here when a teacher requests a slot that the section already has a class in."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clashes.map((clash) => (
        <Card
          key={clash.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
              <TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden />
              {clash.classroomTitle} · Section {clash.section}
              <Badge
                variant={
                  clash.status === "PENDING"
                    ? "destructive"
                    : clash.status === "RESOLVED"
                      ? "default"
                      : "secondary"
                }
              >
                {clash.status === "PENDING"
                  ? "Needs attention"
                  : clash.status === "RESOLVED"
                    ? "Resolved"
                    : "Dismissed"}
              </Badge>
            </p>
            <p className="text-sm text-foreground">
              {clash.requestedByName}{" "}
              {clash.currentDayOfWeek !== null ? "wants to move it to" : "requested"}{" "}
              {formatSlot(clash.dayOfWeek, clash.startHour)} · Room {clash.room}
            </p>
            {clash.currentDayOfWeek !== null && clash.currentStartHour !== null ? (
              <p className="text-sm text-muted-foreground">
                Move request - currently booked{" "}
                {formatSlot(clash.currentDayOfWeek, clash.currentStartHour)} · Room{" "}
                {clash.currentRoom}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {clash.kind === "ROOM"
                ? `Room ${clash.room} already in use by `
                : "Already booked by "}
              {clash.conflictingClassroomTitle ?? "another class"}
              {clash.conflictingTeacherName ? ` (${clash.conflictingTeacherName})` : ""}
            </p>
            {clash.status === "RESOLVED" &&
            clash.resolvedDayOfWeek !== null &&
            clash.resolvedStartHour !== null ? (
              <p className="text-sm text-muted-foreground">
                Moved to {formatSlot(clash.resolvedDayOfWeek, clash.resolvedStartHour)}
                {clash.resolvedRoom ? ` · Room ${clash.resolvedRoom}` : ""}
                {clash.resolvedByName ? ` by ${clash.resolvedByName}` : ""}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Reported {formatShortDate(clash.createdAt)}
            </p>
          </div>

          {clash.status === "PENDING" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setResolveTarget(clash)}>
                Resolve
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDismissTarget(clash)}>
                Dismiss
              </Button>
            </div>
          ) : null}
        </Card>
      ))}

      {resolveTarget ? (
        <ResolveClashDialog
          clash={resolveTarget}
          rooms={rooms}
          onOpenChange={(open) => !open && setResolveTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={dismissTarget !== null}
        onOpenChange={(open) => !open && setDismissTarget(null)}
        title="Dismiss this request?"
        description="First come, first served: the class that already holds the slot keeps it. A new booking is simply not made; a move request is declined and the class stays where it is. The requesting teacher is notified either way."
        confirmLabel="Dismiss request"
        pending={isDismissing}
        onConfirm={confirmDismiss}
      />
    </div>
  );
}
