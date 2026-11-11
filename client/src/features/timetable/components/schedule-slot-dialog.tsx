import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Select } from "@/components/ui/select";

import { rescheduleSlotAction, scheduleSlotAction } from "../api";
import { getSlotAvailabilityAction } from "../api";
import { ROOM_FORMAT_MESSAGE, formatSlot, isValidRoom, sanitizeRoomInput } from "../lib/slots";
import type { TimetableClassroomOption, TimetableSlotView } from "../types";
import { DayPicker } from "./day-picker";
import { RoomOccupancy, applyRoomToAvailability } from "./room-occupancy";
import { SlotPicker } from "./slot-picker";
import { useSlotAvailability } from "./use-slot-availability";

type ScheduleSlotDialogProps = {
  onOpenChange: (open: boolean) => void;
  /** Registered room numbers. */
  rooms: string[];
} & (
  | { mode: "create"; classrooms: TimetableClassroomOption[] }
  | { mode: "reschedule"; slot: TimetableSlotView }
);

/** Mounted only while open, so every open starts from a clean form. */
export function ScheduleSlotDialog(props: ScheduleSlotDialogProps) {
  const { onOpenChange, rooms } = props;
  const isCreate = props.mode === "create";

  const [classroomId, setClassroomId] = useState(
    props.mode === "create" ? (props.classrooms[0]?.id ?? "") : props.slot.classroomId,
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(
    props.mode === "reschedule" ? props.slot.dayOfWeek : null,
  );
  const [room, setRoom] = useState(props.mode === "reschedule" ? props.slot.room : "");
  // Rescheduling starts on the class's current hour, so the room list for that
  // hour is visible straight away instead of only after picking a new slot.
  const [hour, setHour] = useState<number | null>(
    props.mode === "reschedule" ? props.slot.startHour : null,
  );
  const [isPending, startTransition] = useTransition();

  const excludeSlotId = props.mode === "reschedule" ? props.slot.id : undefined;

  const roomIsValid = isValidRoom(room) && rooms.includes(room);
  const availabilityKey =
    classroomId && dayOfWeek !== null ? `${classroomId}|${dayOfWeek}|${excludeSlotId ?? ""}` : null;
  const availability = useSlotAvailability(availabilityKey, () =>
    getSlotAvailabilityAction({ classroomId, dayOfWeek: dayOfWeek ?? 0, excludeSlotId }),
  );
  // The typed room is checked against each hour's booked rooms locally - no refetch per keystroke.
  const hours = applyRoomToAvailability(availability.hours, room);

  const selectedSlot = hours?.find((slot) => slot.hour === hour);
  const selectedState = selectedSlot?.state;
  // Both new bookings and reschedules may pick a clashing slot: it goes to the admin.
  const willClash = selectedState === "section_taken" || selectedState === "room_taken";
  const unchanged =
    props.mode === "reschedule" &&
    dayOfWeek === props.slot.dayOfWeek &&
    hour === props.slot.startHour &&
    room === props.slot.room;
  const canSubmit = !unchanged && roomIsValid && (selectedState === "free" || willClash);

  function submit() {
    if (hour === null || dayOfWeek === null || !classroomId || !roomIsValid) {
      return;
    }

    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await scheduleSlotAction({ classroomId, dayOfWeek, startHour: hour, room })
          : await rescheduleSlotAction({
              slotId: props.slot.id,
              dayOfWeek,
              startHour: hour,
              room,
            });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      if (result.data.outcome === "clash") {
        toast.warning(result.data.message, { duration: 10000 });
      } else {
        toast.success(result.data.message);
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Schedule a class" : "Reschedule class"}</DialogTitle>
          <DialogDescription>
            {props.mode === "reschedule"
              ? `${props.slot.classroomTitle} - currently ${formatSlot(props.slot.dayOfWeek, props.slot.startHour)} in Room ${props.slot.room}.`
              : "Add a class to your weekly timetable: pick the day and a one-hour slot (8:00 AM - 5:00 PM), then a free room. It repeats every week, and the class's students are notified automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {props.mode === "create" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timetable-classroom">Class</Label>
              <Select
                id="timetable-classroom"
                value={classroomId}
                onChange={(event) => {
                  setClassroomId(event.target.value);
                  setHour(null);
                }}
              >
                {props.classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.title} - Section {classroom.section}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>Day</Label>
            <DayPicker
              value={dayOfWeek}
              onChange={(day) => {
                setDayOfWeek(day);
                setHour(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Time slot</Label>
            <SlotPicker
              availability={hours}
              loading={availability.loading}
              value={hour}
              onChange={setHour}
              allowTaken
            />
            {availability.error ? (
              <p className="text-xs text-destructive">{availability.error}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timetable-room">Room no.</Label>
            <Input
              id="timetable-room"
              value={room}
              inputMode="numeric"
              maxLength={3}
              placeholder="e.g. 204"
              onChange={(event) => setRoom(sanitizeRoomInput(event.target.value))}
            />
            <p
              className={`text-xs ${room !== "" && !roomIsValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {room !== "" && !isValidRoom(room)
                ? ROOM_FORMAT_MESSAGE
                : room !== "" && !roomIsValid
                  ? `Room ${room} isn't a registered room - pick one from the list below.`
                  : "Pick a free room below, or type its 3-digit number (first digit = floor)."}
            </p>
            <RoomOccupancy slot={selectedSlot} room={room} rooms={rooms} onSelect={setRoom} />
            {unchanged ? (
              <p className="text-xs text-muted-foreground">
                This is the class&apos;s current slot and room - pick a different day, time or room
                to move it.
              </p>
            ) : null}
          </div>

          {willClash ? (
            <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              {selectedState === "room_taken"
                ? "That room is already in use at this time."
                : "This section already has a class in that slot."}{" "}
              Your request will be sent to the admin to resolve - they&apos;ll move your class to a
              free slot and you&apos;ll be notified.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !canSubmit || dayOfWeek === null || !classroomId}
          >
            {isPending
              ? "Saving…"
              : willClash
                ? "Report clash to admin"
                : isCreate
                  ? "Schedule"
                  : "Move class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
