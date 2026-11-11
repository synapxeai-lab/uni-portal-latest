import { useEffect, useState, useTransition } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { globalSearchAction } from "../api";
import { SEARCH_DEBOUNCE_MS } from "../lib/search-constants";
import { isSearchableQuery, normalizeQuery } from "../lib/search-text";
import type { SearchEntityType, SearchResults } from "../types";

const EMPTY_RESULTS: SearchResults = {
  query: "",
  totalCount: 0,
  items: [],
  countsByType: { classroom: 0, announcement: 0, assignment: 0, material: 0, topic: 0, user: 0 },
};

/**
 * Debounced, client-side global search - reusable infrastructure, not wired
 * into any entity-specific UI yet (Phase 15.1 is search infrastructure
 * only). A future search box would feed raw keystrokes via `setQuery`; this
 * debounces them, skips trivial (too-short) queries without a network call,
 * and calls the shared globalSearchAction, exposing loading/result state.
 */
export function useGlobalSearch(entityTypes?: SearchEntityType[]) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const normalized = normalizeQuery(debouncedQuery);

    if (!isSearchableQuery(normalized)) {
      // Resetting to the empty result set for a too-short query, not
      // deriving state that render could compute directly - startTransition
      // below is the actual async data fetch this effect exists for.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setResults(EMPTY_RESULTS);
      return;
    }

    startTransition(async () => {
      const next = await globalSearchAction(normalized, entityTypes);
      setResults(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  return { query, setQuery, results, isPending };
}
