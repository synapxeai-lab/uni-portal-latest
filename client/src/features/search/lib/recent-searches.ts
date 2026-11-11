const MAX_RECENT_SEARCHES = 8;
const STORAGE_KEY_PREFIX = "portal:recent-searches";

function storageKey(userKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userKey}`;
}

/**
 * Recent searches are stored per-browser in localStorage, namespaced by the
 * signed-in user's email so switching accounts in the same browser (a
 * common thing to do while testing this app locally) doesn't mix one
 * person's search history into another's.
 */
export function getRecentSearches(userKey: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

/** Adds a query to the front of the recent-searches list, de-duplicated case-insensitively and capped at MAX_RECENT_SEARCHES. */
export function addRecentSearch(userKey: string, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") {
    return getRecentSearches(userKey);
  }

  const existing = getRecentSearches(userKey).filter(
    (entry) => entry.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [trimmed, ...existing].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(next));
  } catch {
    // Storage can legitimately fail (private browsing, quota) - recent
    // searches are a convenience, not a feature worth surfacing an error for.
  }

  return next;
}

export function clearRecentSearches(userKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(userKey));
  } catch {
    // See addRecentSearch - non-fatal.
  }
}
