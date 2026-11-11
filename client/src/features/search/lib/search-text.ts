import { MIN_QUERY_LENGTH } from "./search-constants";

/** Collapses whitespace and trims - the one normalization every search entry point applies before touching the database. */
export function normalizeQuery(rawQuery: string): string {
  return rawQuery.trim().replace(/\s+/g, " ");
}

/** Whether a (normalized) query is long enough to actually search with. */
export function isSearchableQuery(query: string): boolean {
  return query.length >= MIN_QUERY_LENGTH;
}

/** Shared snippet truncation for search result descriptions - single ellipsis convention reused across every entity type's mapper. */
export function truncateSnippet(text: string, maxLength = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}
