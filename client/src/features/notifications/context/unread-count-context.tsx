import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { usePathname } from "@/lib/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

const NOTIFICATIONS_PATH = "/notifications";
// Only fetched when no session-seeded count exists - see server notification.routes.ts.
const UNREAD_COUNT_URL = "/notifications/unread-count";
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
 * Backed by the TanStack Query cache (see QueryProvider). The count comes with
 * the session on page load (`initialCount`) and is never refetched - no
 * polling, no refetch on navigation or window focus. It only changes locally
 * as the user reads/deletes notifications, and a page refresh picks up new ones.
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
  const { data } = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
    initialData: initialCount,
    // Fetched at most once (only when there is no session-seeded count).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // On the notifications page itself everything has just been marked read.
    enabled: !onNotificationsPage,
  });

  useEffect(() => {
    if (onNotificationsPage) {
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, 0);
    }
  }, [onNotificationsPage, queryClient]);

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
