import { useMemo, type KeyboardEvent } from "react";
import Link from "@/components/ui/link";
import { useRouter } from "@/lib/navigation";
import { Clock, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { useSearchDialog } from "../context/search-dialog-context";
import { useGlobalSearch } from "../hooks/use-global-search";
import { useRecentSearches } from "../hooks/use-recent-searches";
import { ENTITY_TYPE_LABEL_PLURAL } from "../lib/search-display";
import { isSearchableQuery } from "../lib/search-text";
import { SEARCH_ENTITY_TYPES, type SearchResultItem } from "../types";
import { SearchResultRow } from "./search-result-row";

function groupByEntityType(items: SearchResultItem[]) {
  const groups = new Map<string, SearchResultItem[]>();
  for (const type of SEARCH_ENTITY_TYPES) {
    const matching = items.filter((item) => item.entityType === type);
    if (matching.length > 0) {
      groups.set(type, matching);
    }
  }
  return groups;
}

export function GlobalSearchDialog({ userKey }: { userKey: string }) {
  const { open, setOpen } = useSearchDialog();
  const { query, setQuery, results, isPending } = useGlobalSearch();
  const { recentSearches, addSearch, clearSearches } = useRecentSearches(userKey);
  const router = useRouter();

  const hasQuery = isSearchableQuery(query.trim());
  const grouped = useMemo(() => groupByEntityType(results.items), [results.items]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function viewAllResults() {
    const trimmed = query.trim();
    if (!isSearchableQuery(trimmed)) {
      return;
    }
    addSearch(trimmed);
    close();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function selectRecentSearch(recent: string) {
    setQuery(recent);
  }

  function handleResultClick() {
    addSearch(query.trim());
    close();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      viewAllResults();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          // Let the input claim focus itself (autoFocus below) instead of
          // Radix focusing the dialog's first focusable element generically.
          event.preventDefault();
          document.getElementById("global-search-input")?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            id="global-search-input"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search classes, announcements, assignments, materials…"
            className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label="Search"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!hasQuery ? (
            recentSearches.length > 0 ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between px-2 pb-1 pt-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recent searches
                  </span>
                  <button
                    type="button"
                    onClick={clearSearches}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((recent) => (
                  <button
                    key={recent}
                    type="button"
                    onClick={() => selectRecentSearch(recent)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{recent}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                <Search className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium text-foreground">Search EITHM</p>
                <p className="text-xs text-muted-foreground">
                  Find classes, announcements, assignments, materials, and topics.
                </p>
              </div>
            )
          ) : isPending ? (
            <SearchLoadingSkeleton />
          ) : results.totalCount === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium text-foreground">
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                Try a different term, or check spelling and try again.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {Array.from(grouped.entries()).map(([type, items]) => (
                <div key={type} className="flex flex-col gap-1">
                  <span className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ENTITY_TYPE_LABEL_PLURAL[type as keyof typeof ENTITY_TYPE_LABEL_PLURAL]}
                  </span>
                  {items.map((item) => (
                    <SearchResultRow
                      key={`${item.entityType}-${item.id}`}
                      item={item}
                      query={query}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasQuery && !isPending ? (
          <div className="border-t border-border p-2">
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={() => {
                addSearch(query.trim());
                close();
              }}
              className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-accent"
            >
              View all results for &ldquo;{query.trim()}&rdquo;
            </Link>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SearchLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 px-2 py-1.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
