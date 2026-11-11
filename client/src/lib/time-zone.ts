import { FALLBACK_TIME_ZONE, isValidTimeZone } from "@portal/shared/datetime/time-zone";

let resolved: string | null = null;

/** The browser's IANA time zone - every date in the UI is formatted in it. */
export function browserTimeZone(): string {
  if (resolved) {
    return resolved;
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  resolved = zone && isValidTimeZone(zone) ? zone : FALLBACK_TIME_ZONE;
  return resolved;
}
