/**
 * The timetable is a weekly template: each entry is a weekday (1 = Monday ..
 * 6 = Saturday) plus a one-hour slot, and it repeats every week until a teacher
 * changes it. Start hours are wall-clock time (8 = 08:00).
 */

export const FIRST_SLOT_HOUR = 8;
export const LAST_SLOT_HOUR = 16; // last slot is 16:00-17:00
export const SLOT_START_HOURS = Array.from(
  { length: LAST_SLOT_HOUR - FIRST_SLOT_HOUR + 1 },
  (_, index) => FIRST_SLOT_HOUR + index,
);

/** Classes run Monday-Saturday. Values match ISO weekdays (1 = Monday). */
export const TIMETABLE_DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= TIMETABLE_DAYS.length;
}

export function dayLabel(day: number): string {
  return TIMETABLE_DAYS.find((entry) => entry.value === day)?.label ?? `Day ${day}`;
}

/** Today's weekday as 1 (Monday)..6 (Saturday), or null on Sunday - in the server's/browser's local time. */
export function todayDayOfWeek(now: Date = new Date()): number | null {
  const iso = ((now.getDay() + 6) % 7) + 1; // Sunday -> 7
  return iso <= TIMETABLE_DAYS.length ? iso : null;
}

/** Placeholder section given to classrooms that pre-date the mandatory-section rule. */
export const UNASSIGNED_SECTION = "Unassigned";

/** Case/whitespace-insensitive section identity, so "3A", "3a" and " 3A " are one section. */
export function toSectionKey(section: string): string {
  return section.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Same normalization as sections. */
export function toRoomKey(room: string): string {
  return room.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Room numbers are exactly three digits: the first digit is the floor, the last
 * two are the room on that floor (204 = floor 2, room 04).
 */
export const ROOM_PATTERN = /^\d{3}$/;
export const ROOM_FORMAT_MESSAGE =
  "Room must be a 3-digit number: the first digit is the floor, the last two are the room (e.g. 204 = floor 2, room 04).";

export function isValidRoom(room: string): boolean {
  return ROOM_PATTERN.test(room.trim());
}

/** Keeps digits only, max three - for the room input's onChange. */
export function sanitizeRoomInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 3);
}

export function isValidSlotHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= FIRST_SLOT_HOUR && hour <= LAST_SLOT_HOUR;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${suffix}`;
}

/** e.g. "10:00 AM - 11:00 AM" */
export function formatHourRange(startHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(startHour + 1)}`;
}

/** e.g. "Mondays, 10:00 AM - 11:00 AM" - plural, since the slot repeats every week. */
export function formatSlot(dayOfWeek: number, startHour: number): string {
  return `${dayLabel(dayOfWeek)}s, ${formatHourRange(startHour)}`;
}

/** e.g. "Oct 14, 2026" - for timestamps such as when a clash was reported. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
