import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatHourRange, isValidRoom, toRoomKey } from "../lib/slots";
import type { SlotHourAvailability } from "../types";

/**
 * Overlays the typed room onto the per-hour availability: a free hour whose
 * occupied-rooms list contains that room becomes "room_taken". Done on the
 * client from data already loaded, so typing a room never refetches - the
 * server re-checks everything when the booking is submitted.
 */
export function applyRoomToAvailability(
  hours: SlotHourAvailability[] | null,
  room: string,
): SlotHourAvailability[] | null {
  if (!hours || !isValidRoom(room)) {
    return hours;
  }

  const key = toRoomKey(room);
  return hours.map((slot) => {
    if (slot.state !== "free") {
      return slot;
    }
    const hit = slot.occupiedRooms.find((occupied) => toRoomKey(occupied.room) === key);
    return hit ? { ...slot, state: "room_taken", occupiedBy: hit.classroomTitle } : slot;
  });
}

interface RoomOccupancyProps {
  /** Availability for the selected hour, or undefined when no hour is picked yet. */
  slot: SlotHourAvailability | undefined;
  /** The room currently entered. */
  room: string;
  /** Registered room numbers. */
  rooms: string[];
  onSelect: (room: string) => void;
}

/**
 * Every registered room for the chosen hour, grouped by floor: free rooms are
 * clickable (picking one fills in the room), booked ones are greyed out with
 * the class using them.
 */
export function RoomOccupancy({ slot, room, rooms, onSelect }: RoomOccupancyProps) {
  if (!slot) {
    return (
      <p className="text-xs text-muted-foreground">Pick a time slot to see which rooms are free.</p>
    );
  }

  const occupiedByRoom = new Map(
    slot.occupiedRooms.map((occupied) => [toRoomKey(occupied.room), occupied]),
  );
  // Include any booked room missing from the register so nothing in use is hidden.
  const allRooms = Array.from(
    new Set([...rooms, ...slot.occupiedRooms.map((occupied) => occupied.room)]),
  ).sort();
  const floors = new Map<string, string[]>();
  for (const number of allRooms) {
    const floor = number.charAt(0);
    floors.set(floor, [...(floors.get(floor) ?? []), number]);
  }

  const freeCount = allRooms.filter((number) => !occupiedByRoom.has(toRoomKey(number))).length;
  const typedOccupant = isValidRoom(room) ? occupiedByRoom.get(toRoomKey(room)) : undefined;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs font-medium text-foreground">
        Rooms at {formatHourRange(slot.hour)} - {freeCount} of {allRooms.length} free
      </p>

      {allRooms.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rooms are registered yet.</p>
      ) : (
        Array.from(floors.entries()).map(([floor, numbers]) => (
          <div key={floor} className="flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Floor {floor}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {numbers.map((number) => {
                const occupant = occupiedByRoom.get(toRoomKey(number));
                const selected = room === number;
                return (
                  <button
                    key={number}
                    type="button"
                    disabled={Boolean(occupant)}
                    onClick={() => onSelect(number)}
                    title={
                      occupant
                        ? `In use by ${occupant.classroomTitle} (Section ${occupant.section})`
                        : `Room ${number} is free`
                    }
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      occupant
                        ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
                        : selected
                          ? "border-gold bg-gold font-semibold text-white"
                          : "border-emerald-500/50 bg-card text-foreground hover:bg-emerald-500/10",
                    )}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {slot.occupiedRooms.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Booked:{" "}
          {slot.occupiedRooms
            .map((occupied) => `${occupied.room} (${occupied.classroomTitle})`)
            .join(", ")}
        </p>
      ) : null}

      {isValidRoom(room) ? (
        typedOccupant ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Room {room} is in use by {typedOccupant.classroomTitle} at this time.
          </p>
        ) : rooms.includes(room) ? (
          <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Room {room} is free at this time.
          </p>
        ) : null
      ) : null}
    </div>
  );
}
