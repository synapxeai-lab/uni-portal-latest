import type { NotificationSummary } from "../types";

export interface NotificationGroup {
  label: "Today" | "Yesterday" | "Earlier";
  notifications: NotificationSummary[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Buckets an already-sorted (newest first) notification list into Today /
 * Yesterday / Earlier sections, dropping any section that ends up empty. */
export function groupNotificationsByDate(
  notifications: NotificationSummary[],
): NotificationGroup[] {
  const todayStart = startOfDay(new Date());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const today: NotificationSummary[] = [];
  const yesterday: NotificationSummary[] = [];
  const earlier: NotificationSummary[] = [];

  for (const notification of notifications) {
    const day = startOfDay(notification.createdAt);
    if (day === todayStart) {
      today.push(notification);
    } else if (day === yesterdayStart) {
      yesterday.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  return [
    { label: "Today" as const, notifications: today },
    { label: "Yesterday" as const, notifications: yesterday },
    { label: "Earlier" as const, notifications: earlier },
  ].filter((group) => group.notifications.length > 0);
}
