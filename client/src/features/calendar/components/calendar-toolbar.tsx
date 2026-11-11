import Link from "@/components/ui/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CALENDAR_VIEW_LABEL } from "../lib/calendar-constants";
import { buildCalendarHref, navigateDate } from "../lib/calendar-date";
import { formatToolbarTitle } from "../lib/calendar-format";
import {
  CALENDAR_VIEW_MODES,
  type CalendarEventType,
  type CalendarRange,
  type CalendarViewMode,
} from "../types";

interface CalendarToolbarProps {
  date: Date;
  view: CalendarViewMode;
  range: CalendarRange;
  classroomId?: string;
  eventTypes: CalendarEventType[];
}

export function CalendarToolbar({
  date,
  view,
  range,
  classroomId,
  eventTypes,
}: CalendarToolbarProps) {
  const filters = { classroomId, eventTypes };
  const previousHref = buildCalendarHref(view, navigateDate(date, view, -1), filters);
  const nextHref = buildCalendarHref(view, navigateDate(date, view, 1), filters);
  const todayHref = buildCalendarHref(view, new Date(), filters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={todayHref}>Today</Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" asChild>
            <Link href={previousHref}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next" asChild>
            <Link href={nextHref}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <h2 className="text-base font-semibold text-foreground sm:text-lg">
          {formatToolbarTitle(date, view, range)}
        </h2>
      </div>
      <div className="flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1">
        {CALENDAR_VIEW_MODES.map((mode) => (
          <Link
            key={mode}
            href={buildCalendarHref(mode, date, filters)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              mode === view
                ? "bg-gold font-semibold text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {CALENDAR_VIEW_LABEL[mode]}
          </Link>
        ))}
      </div>
    </div>
  );
}
