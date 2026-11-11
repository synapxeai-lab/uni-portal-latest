import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { usePathname } from "@/lib/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const NOTIFICATIONS_PATH = "/notifications";
// Polled from the API - see server notification.routes.ts.
const UNREAD_COUNT_URL = "/notifications/unread-count";
const POLL_INTERVAL_MS = 15_000;
// A count younger than this is reused on navigation, window focus, and shell
// remounts instead of being fetched again.
const STALE_TIME_MS = 10_000;
export const UNREAD_COUNT_QUERY_KEY = ["notifications", "unread-count"] as const;

interface UnreadCountValue {
  count: number;
  /** Apply an optimistic change (e.g. -1 when one notification is marked read). */
  adjust: (delta: number) => void;
}

const UnreadCountContext = createContext<UnreadCountValue | null>(null);

async function fetchUnreadCount(): Promise<number> {
  const body = await apiGet<{ count?: unknown }>(UNREAD_COUNT_URL);
  if (typeof body.count !== "number") {
    throw new Error("Unread count response was malformed");
  }
  return body.count;
}

/**
 * Single source of truth for the unread-notification count, shared by the
 * header bell and the sidebar's Notifications dot so the two never disagree.
 *
 * Backed by the TanStack Query cache (see QueryProvider): polled every 15s
 * while the tab is visible, and refetched on navigation or window focus once
 * the count is more than 10s old, with concurrent requests de-duplicated. A server-seeded
 * `initialCount` counts as fresh, so a page load doesn't immediately fetch the
 * number it was just rendered with. A failed poll keeps the last known count.
 *
 * Opening the notifications page marks everything read (the page does that on
 * the server), so the count drops to 0 the moment the user navigates there -
 * no "mark all read" click needed.
 */
export function UnreadCountProvider({
  initialCount,
  children,
}: {
  /** Omit when the caller has no server-side count; it's fetched on mount instead. */
  initialCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const onNotificationsPage = pathname === NOTIFICATIONS_PATH;
  const queryClient = useQueryClient();
  const [mountedAt] = useState(() => Date.now());

  const { data } = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
    initialData: initialCount,
    // Only stamp server-seeded data as fresh; without it, fetch on mount.
    initialDataUpdatedAt: initialCount === undefined ? undefined : mountedAt,
    staleTime: STALE_TIME_MS,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    // On the notifications page itself everything has just been marked read.
    enabled: !onNotificationsPage,
  });

  useEffect(() => {
    if (onNotificationsPage) {
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, 0);
    } else {
      void queryClient.refetchQueries({ queryKey: UNREAD_COUNT_QUERY_KEY, stale: true });
    }
  }, [pathname, onNotificationsPage, queryClient]);

  const adjust = useCallback(
    (delta: number) =>
      queryClient.setQueryData<number>(UNREAD_COUNT_QUERY_KEY, (previous) =>
        Math.max(0, (previous ?? 0) + delta),
      ),
    [queryClient],
  );

  const count = onNotificationsPage ? 0 : (data ?? 0);
  const value = useMemo(() => ({ count, adjust }), [count, adjust]);

  return <UnreadCountContext.Provider value={value}>{children}</UnreadCountContext.Provider>;
}

/** The shared unread count, or null outside an UnreadCountProvider. */
export function useUnreadCount(): UnreadCountValue | null {
  return useContext(UnreadCountContext);
}
