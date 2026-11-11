import { useTimeZone } from "@/components/providers/time-zone-provider";
import {
  formatDate,
  formatDateTime,
  formatDueDate,
  formatRelativeTime,
  formatTime,
} from "@/lib/datetime/format";

const FORMATTERS = {
  date: formatDate,
  dateTime: formatDateTime,
  due: formatDueDate,
  relative: formatRelativeTime,
  time: (date: Date, timeZone: string) => formatTime(date, timeZone),
} as const;

export type DateTimeVariant = keyof typeof FORMATTERS;

interface DateTimeTextProps {
  /** A Date, or an ISO string from a JSON payload. */
  value: Date | string;
  variant?: DateTimeVariant;
  className?: string;
}

/**
 * Renders a date in the app's single format, in the viewer's time zone.
 * Safe in server and client trees alike - use this rather than calling
 * toLocale*() anywhere, which would format in whichever zone happens to run it.
 */
export function DateTimeText({ value, variant = "dateTime", className }: DateTimeTextProps) {
  const timeZone = useTimeZone();
  const date = value instanceof Date ? value : new Date(value);

  return (
    <time
      dateTime={date.toISOString()}
      title={formatDateTime(date, timeZone)}
      className={className}
      // "today"/"5m ago" can tick over between server render and hydration.
      suppressHydrationWarning
    >
      {FORMATTERS[variant](date, timeZone)}
    </time>
  );
}
