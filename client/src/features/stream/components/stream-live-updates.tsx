import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { UNREAD_COUNT_QUERY_KEY } from "@/features/notifications/context/unread-count-context";

import { fetchStreamVersion, markStreamNotificationsRead, streamKeys } from "../api";

// Short enough that a comment shows up for everyone else on the page within a
// few seconds; TanStack Query pauses the poll while the tab is hidden.
const POLL_INTERVAL_MS = 5_000;

/**
 * Keeps an open stream page live: polls the stream's change fingerprint and,
 * when another member posts, comments, edits or deletes, refetches just this
 * stream's announcements in place (client state such as a half-typed comment
 * and scroll position is kept). The mutation that caused the change already
 * expired the server cache, so the refetch always gets fresh data.
 *
 * While the page is visible it also marks this classroom's announcement and
 * class-comment notifications read (on open, and whenever something new
 * arrives) - the viewer is already looking at what they're about, so the bell
 * shouldn't keep pointing at them. A hidden tab doesn't count as seeing them.
 *
 * Also scrolls to the post named in the URL hash (#announcement-<id>), which
 * is where comment/announcement notifications link to.
 */
export function StreamLiveUpdates({ classroomId }: { classroomId: string }) {
  const queryClient = useQueryClient();
  const lastVersion = useRef<string | null>(null);
  // A change is detected as soon as the comment/post row exists, which can be
  // a moment before its notifications are written - so after marking read on
  // a change, mark once more on the next poll to catch any that landed late.
  const markAgain = useRef(false);

  const { data: version, dataUpdatedAt } = useQuery({
    queryKey: streamKeys.version(classroomId),
    queryFn: () => fetchStreamVersion(classroomId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!version) {
      return;
    }
    const isFirst = lastVersion.current === null;
    const changed = !isFirst && lastVersion.current !== version;
    lastVersion.current = version;

    if (changed) {
      void queryClient.invalidateQueries({ queryKey: streamKeys.announcements(classroomId) });
    }

    if (document.visibilityState !== "visible") {
      markAgain.current = markAgain.current || isFirst || changed;
      return;
    }

    const shouldMarkRead = isFirst || changed || markAgain.current;
    markAgain.current = changed;
    if (!shouldMarkRead) {
      return;
    }

    markStreamNotificationsRead(classroomId)
      .catch((error: unknown) => console.error(error))
      .finally(() => queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY }));
    // dataUpdatedAt: re-run on every successful poll, not only when the version changes.
  }, [version, dataUpdatedAt, classroomId, queryClient]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#announcement-")) {
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return null;
}
