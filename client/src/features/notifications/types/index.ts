import type { NotificationType } from "@portal/shared/enums";

export type { ActionResult } from "@/types/action-result";
export type { NotificationType } from "@portal/shared/enums";

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Where clicking this notification should navigate to; null for
   * notifications with no associated resource to jump to. */
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPage {
  notifications: NotificationSummary[];
  /** Pass back as `cursor` to fetch the next page; null once there's nothing more. */
  nextCursor: string | null;
}
