/**
 * The viewer's IANA time zone. The browser formats every date in its own
 * zone, and sends it to the API in the X-Time-Zone header so the server can
 * read wall-clock form inputs ("2026-11-11T09:00") as that zone - the
 * server's own zone (UTC in containers) never leaks into anything a user sees.
 */
export const TIME_ZONE_HEADER = "x-time-zone";

/** Used only when the client did not report a valid zone. */
export const FALLBACK_TIME_ZONE = "UTC";

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(value: string | null | undefined): string {
  return value && isValidTimeZone(value) ? value : FALLBACK_TIME_ZONE;
}
