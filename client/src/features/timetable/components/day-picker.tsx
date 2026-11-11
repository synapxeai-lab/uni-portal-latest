import { cn } from "@/lib/utils";

import { TIMETABLE_DAYS } from "../lib/slots";

interface DayPickerProps {
  value: number | null;
  onChange: (day: number) => void;
}

/** Monday-Saturday selector for the weekly timetable. */
export function DayPicker({ value, onChange }: DayPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Day">
      {TIMETABLE_DAYS.map((day) => {
        const selected = value === day.value;
        return (
          <button
            key={day.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(day.value)}
            className={cn(
              "rounded-lg border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            <span aria-hidden>{day.short}</span>
            <span className="sr-only">{day.label}</span>
          </button>
        );
      })}
    </div>
  );
}
