import { useCallback, useState } from "react";

import { getNotificationsAction } from "../api";
import { useUnreadCount } from "../context/unread-count-context";
import type { NotificationSummary } from "../types";
import { useNotificationMutations } from "./use-notification-mutations";

interface UseNotificationsOptions {
  initialUnreadCount: number;
}

/**
 * Owns all client-side state for the notification dropdown: the list (fetched
 * lazily on open) and the badge count. Mutation logic (mark-read/mark-all/
 * delete) is shared with useNotificationCenter via useNotificationMutations -
 * the only thing specific to this widget is that it tracks unread count as
 * its own state (so the badge has a number before the list has ever been
 * fetched), rather than deriving it from the loaded list.
 */
export function useNotifications({ initialUnreadCount }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  // Inside the app shell the count is shared with the sidebar dot (see
  // UnreadCountProvider); the local state is only a fallback outside it.
  const shared = useUnreadCount();
  const [localUnreadCount, setLocalUnreadCount] = useState(initialUnreadCount);
  const unreadCount = shared ? shared.count : localUnreadCount;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getNotificationsAction({});

    if (result.status === "success") {
      setNotifications(result.data.notifications);
      setNextCursor(result.data.nextCursor);
      setHasLoadedOnce(true);
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    const result = await getNotificationsAction({ cursor: nextCursor });

    if (result.status === "success") {
      setNotifications((previous) => [...previous, ...result.data.notifications]);
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.message);
    }

    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore]);

  const { markRead, markAllRead, remove } = useNotificationMutations({
    notifications,
    setNotifications,
    onUnreadDelta: (delta) =>
      shared
        ? shared.adjust(delta)
        : setLocalUnreadCount((previous) => Math.max(0, previous + delta)),
  });

  return {
    notifications,
    unreadCount,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    hasLoadedOnce,
    load,
    loadMore,
    markRead,
    markAllRead,
    remove,
  };
}
