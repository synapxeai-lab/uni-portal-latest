import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";

import type { SearchEntityType, SearchResults } from "./types";

function fetchSearch(query: string, entityTypes?: SearchEntityType[], limitPerType?: number) {
  return apiGet<SearchResults>("/search", {
    params: { q: query, types: entityTypes?.join(",") || undefined, limitPerType },
  });
}

/** Same signature as the old Server Action - used by the Ctrl/Cmd+K dialog. */
export function globalSearchAction(
  query: string,
  entityTypes?: SearchEntityType[],
): Promise<SearchResults> {
  return fetchSearch(query, entityTypes);
}

/** The /search results page. */
export function useSearchResults(
  query: string,
  entityTypes: SearchEntityType[] | undefined,
  limitPerType: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["search", query, entityTypes ?? "all", limitPerType],
    queryFn: () => fetchSearch(query, entityTypes, limitPerType),
    enabled,
    placeholderData: keepPreviousData,
  });
}
