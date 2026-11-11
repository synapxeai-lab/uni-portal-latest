import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";

interface StreamFreshnessValue {
  /** Announcement and comment ids the viewer had already seen when this visit began. */
  initialIds: ReadonlySet<string>;
  viewerId: string;
}

const StreamFreshnessContext = createContext<StreamFreshnessValue | null>(null);

/**
 * Remembers what the stream looked like when the viewer opened it, so posts
 * and comments that arrive afterwards (via StreamLiveUpdates' refresh) can be
 * flagged "New" - their notifications are auto-marked read while the stream is
 * open, so this is how the viewer notices them instead. The snapshot is taken
 * once per visit: refreshes keep it, leaving and coming back resets it.
 *
 * With Cache Components, navigating away doesn't unmount the page - Next.js
 * hides it in an <Activity> and keeps its state, so the snapshot would survive
 * and the same items would still read "New" on return. The layout-effect
 * cleanup below runs when the page is hidden and marks everything currently
 * on the stream as seen.
 */
export function StreamFreshnessProvider({
  initialIds,
  viewerId,
  children,
}: {
  /** Every announcement and comment id currently on the stream. */
  initialIds: string[];
  viewerId: string;
  children: ReactNode;
}) {
  const [seenIds, setSeenIds] = useState<ReadonlySet<string>>(() => new Set(initialIds));
  const latestIds = useRef(initialIds);

  useLayoutEffect(() => {
    latestIds.current = initialIds;
  }, [initialIds]);

  useLayoutEffect(() => {
    return () => {
      setSeenIds(new Set(latestIds.current));
    };
  }, []);

  const value = useMemo<StreamFreshnessValue>(
    () => ({ initialIds: seenIds, viewerId }),
    [seenIds, viewerId],
  );

  return (
    <StreamFreshnessContext.Provider value={value}>{children}</StreamFreshnessContext.Provider>
  );
}

/** Whether this item arrived while the viewer had the stream open - never true for their own items. */
export function useIsNewStreamItem(itemId: string, authorId: string): boolean {
  const freshness = useContext(StreamFreshnessContext);
  if (!freshness || authorId === freshness.viewerId) {
    return false;
  }
  return !freshness.initialIds.has(itemId);
}

export function NewStreamItemBadge({ itemId, authorId }: { itemId: string; authorId: string }) {
  const isNew = useIsNewStreamItem(itemId, authorId);
  return isNew ? (
    <Badge variant="info" className="shrink-0">
      New
    </Badge>
  ) : null;
}
