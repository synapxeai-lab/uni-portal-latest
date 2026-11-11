import { browserTimeZone } from "@/lib/time-zone";

/**
 * The viewer's time zone. Everything renders in the browser now, so this is
 * simply the browser's own zone - the same value the API receives in the
 * X-Time-Zone header for reading wall-clock form inputs.
 */
export function useTimeZone(): string {
  return browserTimeZone();
}
