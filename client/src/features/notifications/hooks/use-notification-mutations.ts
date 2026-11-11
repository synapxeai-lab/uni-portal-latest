import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../api";
import type { NotificationSummary } from "../types";

interface UseNotificationMutationsOptions {
  notifications: NotificationSummary[];
  setNotifications: Dispatch<SetStateAction<NotificationSummary[]>>;
  /** Called with the signed change in unread count as each mutation is
   * optimistically applied (negative) or rolled back on failure (positive).
   * Omit when the caller derives its unread count directly from
   * `notifications` instead of tracking a separate counter. */
  onUnreadDelta?: (delta: number) => void;
}

/**
 * Shared optimistic mark-read / mark-all-read / delete logic - both the
 * header dropdown (useNotifications) and the full notification center
 * (useNotificationCenter) call this instead of each reimplementing the same
 * optimistic-update-then-revert-on-failure dance. Failures surface via toast
 * since these are background mutations with no other visible error affordance.
 */
export function useNotificationMutations({
  notifications,
  setNotifications,
  onUnreadDelta,
}: UseNotificationMutationsOptions) {
  const markRead = useCallback(
    async (notificationId: string) => {
      const target = notifications.find((notification) => notification.id === notificationId);
      if (!target || target.isRead) {
        return;
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      );
      onUnreadDelta?.(-1);

      const result = await markNotificationReadAction(notificationId);

      if (result.status !== "success") {
        setNotifications((previous) =>
          previous.map((notification) =>
            notification.id === notificationId ? { ...notification, isRead: false } : notification,
          ),
        );
        onUnreadDelta?.(1);
        toast.error(result.message);
      }
    },
    [notifications, setNotifications, onUnreadDelta],
  );

  const markAllRead = useCallback(async () => {
    const previousNotifications = notifications;
    const unreadDelta = notifications.filter((notification) => !notification.isRead).length;

    if (unreadDelta === 0) {
      return;
    }

    setNotifications((previous) =>
      previous.map((notification) => ({ ...notification, isRead: true })),
    );
    onUnreadDelta?.(-unreadDelta);

    const result = await markAllNotificationsReadAction();

    if (result.status !== "success") {
      setNotifications(previousNotifications);
      onUnreadDelta?.(unreadDelta);
      toast.error(result.message);
    }
  }, [notifications, setNotifications, onUnreadDelta]);

  const remove = useCallback(
    async (notificationId: string) => {
      const targetIndex = notifications.findIndex(
        (notification) => notification.id === notificationId,
      );
      if (targetIndex === -1) {
        return;
      }
      const target = notifications[targetIndex];

      setNotifications((previous) =>
        previous.filter((notification) => notification.id !== notificationId),
      );
      if (!target.isRead) {
        onUnreadDelta?.(-1);
      }

      const result = await deleteNotificationAction(notificationId);

      if (result.status !== "success") {
        setNotifications((previous) => {
          const next = [...previous];
          next.splice(targetIndex, 0, target);
          return next;
        });
        if (!target.isRead) {
          onUnreadDelta?.(1);
        }
        toast.error(result.message);
      }
    },
    [notifications, setNotifications, onUnreadDelta],
  );

  return { markRead, markAllRead, remove };
}
