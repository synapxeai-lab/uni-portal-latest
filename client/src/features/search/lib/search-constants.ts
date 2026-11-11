/** Below this length a query is treated as "not yet searching" - avoids full-table-ish scans on a single character. */
export const MIN_QUERY_LENGTH = 2;

/** Default max results per entity type when a caller doesn't specify one. */
export const DEFAULT_LIMIT_PER_TYPE = 5;

/** Debounce delay used by the shared search hook, matching this codebase's existing debounced-filter conventions (e.g. admin report filters). */
export const SEARCH_DEBOUNCE_MS = 300;
