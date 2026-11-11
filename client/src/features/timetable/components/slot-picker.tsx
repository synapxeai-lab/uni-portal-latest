import { cn } from "@/lib/utils";

import { formatHourRange } from "../lib/slots";
import type { SlotHourAvailability } from "../types";

interface SlotPickerProps {
  availability: SlotHourAvailability[] | null;
  loading: boolean;
  value: number | null;
  onChange: (hour: number) => void;
  /**
   * Whether a slot already held by another class in the section can still be
   * picked. Teachers may pick one anyway (it raises a clash for the admin);
   * the admin, who is moving a class to a free slot, may not.
   */
  allowTaken: boolean;
}

function describe(slot: SlotHourAvailability, allowTaken: boolean): string | null {
  switch (slot.state) {
    case "section_taken":
      return allowTaken ? `Booked: ${slot.occupiedBy} (clash)` : `Booked: ${slot.occupiedBy}`;
    case "room_taken":
      return allowTaken
        ? `Room in use: ${slot.occupiedBy} (clash)`
        : `Room in use: ${slot.occupiedBy}`;
    case "teacher_busy":
      return `You teach ${slot.occupiedBy}`;
    default:
      return null;
  }
}

export function SlotPicker({
  availability,
  loading,
  value,
  onChange,
  allowTaken,
}: SlotPickerProps) {
  if (loading || !availability) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "Checking availability…" : "Pick a day to see the time slots."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time slot">
      {availability.map((slot) => {
        const isClash = slot.state === "section_taken" || slot.state === "room_taken";
        const selectable = slot.state === "free" || (allowTaken && isClash);
        const note = describe(slot, allowTaken);
        const selected = value === slot.hour;

        return (
          <button
            key={slot.hour}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!selectable}
            onClick={() => onChange(slot.hour)}
            className={cn(
              "flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
              isClash && allowTaken && !selected && "border-amber-500/60",
              !selectable && "cursor-not-allowed opacity-50 hover:bg-card",
            )}
          >
            <span className="font-medium">{formatHourRange(slot.hour)}</span>
            {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
