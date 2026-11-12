import { useCallback, useState } from "react";

import { getNotificationsAction } from "../api";
import type { NotificationSummary, NotificationType } from "../types";
import { useNotificationMutations } from "./use-notification-mutations";

export type NotificationTypeFilter = "ALL" | NotificationType;

interface UseNotificationCenterOptions {
  initialNotifications: NotificationSummary[];
  initialCursor: string | null;
}

// The 10 most recent at a time; older ones load with "Load more".
const PAGE_SIZE = 10;

/**
 * Owns state for the full-page notification center: server-seeded initial
 * data, filter-driven reloads (type + unread-only), and cursor pagination.
 * Mutation logic (mark-read/mark-all/delete) is shared with useNotifications
 * (the header dropdown's hook) via useNotificationMutations - this hook just
 * derives unread count directly from the loaded list instead of tracking a
 * separate counter, since the page always has the list loaded.
 */
export function useNotificationCenter({
  initialNotifications,
  initialCursor,
}: UseNotificationCenterOptions) {
  const [notifications, setNotifications] = useState<NotificationSummary[]>(initialNotifications);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (nextType: NotificationTypeFilter, nextUnreadOnly: boolean) => {
    setIsLoading(true);
    setError(null);

    const result = await getNotificationsAction({
      limit: PAGE_SIZE,
      unreadOnly: nextUnreadOnly,
      type: nextType === "ALL" ? undefined : nextType,
    });

    if (result.status === "success") {
      setNotifications(result.data.notifications);
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  }, []);

  const setFilter = useCallback(
    (nextType: NotificationTypeFilter) => {
      setTypeFilter(nextType);
      reload(nextType, unreadOnly);
    },
    [reload, unreadOnly],
  );

  const setUnreadOnlyFilter = useCallback(
    (nextUnreadOnly: boolean) => {
      setUnreadOnly(nextUnreadOnly);
      reload(typeFilter, nextUnreadOnly);
    },
    [reload, typeFilter],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    const result = await getNotificationsAction({
      cursor: nextCursor,
      limit: PAGE_SIZE,
      unreadOnly,
      type: typeFilter === "ALL" ? undefined : typeFilter,
    });

    if (result.status === "success") {
      setNotifications((previous) => [...previous, ...result.data.notifications]);
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.message);
    }

    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, unreadOnly, typeFilter]);

  const { markRead, markAllRead, remove } = useNotificationMutations({
    notifications,
    setNotifications,
  });

  return {
    notifications,
    nextCursor,
    typeFilter,
    unreadOnly,
    isLoading,
    isLoadingMore,
    error,
    setFilter,
    setUnreadOnlyFilter,
    loadMore,
    markRead,
    markAllRead,
    remove,
    retry: () => reload(typeFilter, unreadOnly),
  };
}
