import type { TodoDueGroup } from "../types";

// Self-contained (not imported from features/calendar/lib) - deliberately a
// small, independent copy of the same pure date math rather than a
// cross-feature dependency on calendar's internals for a handful of
// one-line functions.
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

/** Sunday-start week, matching the convention already used by the Calendar feature. */
function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

/**
 * Buckets a due date relative to `referenceDate`'s week - applied uniformly
 * across every tab (Assigned/Missing/Done), per the To-do spec. "Later"
 * is a catch-all for anything outside the current/next week window in
 * either direction, which is what naturally captures old overdue Missing
 * items (before this week) as well as far-future Assigned ones (after next
 * week) without any tab-specific special-casing.
 */
export function getDueGroup(dueDate: Date | null, referenceDate: Date = new Date()): TodoDueGroup {
  if (!dueDate) {
    return "no-due-date";
  }

  const weekStart = startOfWeek(referenceDate);
  const weekEnd = addDays(weekStart, 7);
  const nextWeekEnd = addDays(weekEnd, 7);

  if (dueDate >= weekStart && dueDate < weekEnd) {
    return "this-week";
  }
  if (dueDate >= weekEnd && dueDate < nextWeekEnd) {
    return "next-week";
  }
  return "later";
}
