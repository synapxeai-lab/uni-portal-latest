/**
 * The one date/time vocabulary for the whole app, modelled on Google
 * Classroom: "Oct 23", "Oct 23, 11:59 PM", "Due today, 11:59 PM", with the
 * year only when it isn't the current one. Every function takes the viewer's
 * time zone explicitly and a fixed en-US locale, so the server and the
 * browser always produce the exact same text.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** Whole calendar days from `now` to `date` in the viewer's zone (0 = same day). */
function calendarDayDiff(date: Date, now: Date, timeZone: string): number {
  const a = getZonedParts(date, timeZone);
  const b = getZonedParts(now, timeZone);
  return Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86_400_000,
  );
}

export function formatTime(date: Date, timeZone: string): string {
  return getFormatter(timeZone, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** "Oct 23", or "Oct 23, 2025" outside the current year. */
export function formatDate(date: Date, timeZone: string, now: Date = new Date()): string {
  const sameYear = getZonedParts(date, timeZone).year === getZonedParts(now, timeZone).year;
  return getFormatter(
    timeZone,
    sameYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  ).format(date);
}

/** "Oct 23, 11:59 PM", or "Oct 23, 2025, 11:59 PM" outside the current year. */
export function formatDateTime(date: Date, timeZone: string, now: Date = new Date()): string {
  return `${formatDate(date, timeZone, now)}, ${formatTime(date, timeZone)}`;
}

/** "Due today, 11:59 PM" / "Due tomorrow, 11:59 PM" / "Due Oct 23, 11:59 PM". */
export function formatDueDate(date: Date, timeZone: string, now: Date = new Date()): string {
  const diff = calendarDayDiff(date, now, timeZone);
  const time = formatTime(date, timeZone);
  if (diff === 0) return `Due today, ${time}`;
  if (diff === 1) return `Due tomorrow, ${time}`;
  if (diff === -1) return `Due yesterday, ${time}`;
  return `Due ${formatDateTime(date, timeZone, now)}`;
}

/** "Just now" / "5m ago" / "3h ago" / "2d ago", then the plain date after a week. */
export function formatRelativeTime(date: Date, timeZone: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return formatDate(date, timeZone, now);
}

/** A span of time in its largest sensible unit: "45 minutes", "3 hours", "2 days". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? "" : "s"}`;
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return unit(hours, "hour");
  return unit(Math.round(hours / 24), "day");
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A stored instant as the "YYYY-MM-DD" / "HH:mm" values of native date and time inputs, in the viewer's zone. */
export function toDateTimeInputParts(
  date: Date | null | undefined,
  timeZone: string,
): { date: string; time: string } {
  if (!date) {
    return { date: "", time: "" };
  }
  const parts = getZonedParts(date, timeZone);
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** A stored instant as a datetime-local input value ("YYYY-MM-DDTHH:mm") in the viewer's zone. */
export function toDateTimeInputValue(date: Date | null | undefined, timeZone: string): string {
  const parts = toDateTimeInputParts(date, timeZone);
  return parts.date ? `${parts.date}T${parts.time}` : "";
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function getTimeZoneOffset(utcMs: number, timeZone: string): number {
  const parts = getZonedParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The inverse of toDateTimeInputValue: reads a wall-clock "YYYY-MM-DDTHH:mm"
 * as a time in `timeZone` and returns the real instant. Never hand such a
 * string to `new Date()` on the server - it would be read in the server's zone.
 */
export function fromDateTimeInputValue(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  // Two passes settle the offset across a DST transition.
  let result = wallClock - getTimeZoneOffset(wallClock, timeZone);
  const corrected = getTimeZoneOffset(result, timeZone);
  result = wallClock - corrected;

  return new Date(result);
}

/** An ISO-8601 timestamp that pins an exact instant (carries "Z" or a "+05:00" offset). */
export function isIsoInstant(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}
