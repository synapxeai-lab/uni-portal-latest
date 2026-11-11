import type { CalendarEventType } from "../types";

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  "assignment-due": "Assignment due",
  "assignment-scheduled": "Assignment scheduled",
  "announcement-scheduled": "Announcement scheduled",
  "material-scheduled": "Material scheduled",
  classroom: "Classroom",
};

export const CALENDAR_EVENT_TYPE_COLOR: Record<CalendarEventType, string> = {
  "assignment-due": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "assignment-scheduled":
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "announcement-scheduled": "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "material-scheduled": "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  classroom: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};
