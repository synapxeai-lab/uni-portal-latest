import { useCallback, useState } from "react";

import { addRecentSearch, clearRecentSearches, getRecentSearches } from "../lib/recent-searches";

/** Thin React wrapper over the localStorage-backed recent-searches utility, keyed per user. */
export function useRecentSearches(userKey: string) {
  // Lazy initializer - reads localStorage once on first client render rather
  // than via a post-mount effect (getRecentSearches is SSR-safe, returning
  // [] when window is unavailable, and this dialog renders nothing visible
  // while closed, so there's no hydration-mismatch content to worry about).
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches(userKey));

  const addSearch = useCallback(
    (query: string) => {
      setRecentSearches(addRecentSearch(userKey, query));
    },
    [userKey],
  );

  const clearSearches = useCallback(() => {
    clearRecentSearches(userKey);
    setRecentSearches([]);
  }, [userKey]);

  return { recentSearches, addSearch, clearSearches };
}
