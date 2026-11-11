import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { CALENDAR_EVENT_TYPE_LABEL } from "../lib/calendar-display";
import { CALENDAR_EVENT_TYPES, type CalendarEventType } from "../types";

interface CalendarFilterBarProps {
  classrooms: { id: string; title: string }[];
  classroomId?: string;
  eventTypes: CalendarEventType[];
}

/** Classroom + event-type filters - URL-driven, same client-navigation convention as ReviewFilterBar/SearchTypeFilters. */
export function CalendarFilterBar({ classrooms, classroomId, eventTypes }: CalendarFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleEventType(type: CalendarEventType) {
    const next = eventTypes.includes(type)
      ? eventTypes.filter((existing) => existing !== type)
      : [...eventTypes, type];
    updateParams({ types: next.length > 0 ? next.join(",") : null });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select
        aria-label="Filter by classroom"
        value={classroomId ?? ""}
        onChange={(event) => updateParams({ classroomId: event.target.value || null })}
        className="sm:w-56"
      >
        <option value="">All classrooms</option>
        {classrooms.map((classroom) => (
          <option key={classroom.id} value={classroom.id}>
            {classroom.title}
          </option>
        ))}
      </Select>

      <div role="group" aria-label="Filter by event type" className="flex flex-wrap gap-1.5">
        {CALENDAR_EVENT_TYPES.map((type) => {
          const active = eventTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleEventType(type)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-gold bg-gold-soft text-gold-foreground dark:text-gold"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {CALENDAR_EVENT_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
