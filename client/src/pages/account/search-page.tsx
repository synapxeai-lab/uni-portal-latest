import { Search } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/skeletons";
import { useSearchResults } from "@/features/search/api";
import { SearchResultRow } from "@/features/search/components/search-result-row";
import { SearchTypeFilters } from "@/features/search/components/search-type-filters";
import { ENTITY_TYPE_LABEL_PLURAL } from "@/features/search/lib/search-display";
import { isSearchableQuery, normalizeQuery } from "@/features/search/lib/search-text";
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from "@/features/search/types";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

const RESULTS_PAGE_LIMIT_PER_TYPE = 20;

function isSearchEntityType(value: string | null): value is SearchEntityType {
  return SEARCH_ENTITY_TYPES.includes(value as SearchEntityType);
}

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const query = normalizeQuery(searchParams.get("q") ?? "");
  const typeParam = searchParams.get("type");
  const activeType = isSearchEntityType(typeParam) ? typeParam : undefined;
  const hasQuery = isSearchableQuery(query);
  const results = useSearchResults(
    query,
    activeType ? [activeType] : undefined,
    RESULTS_PAGE_LIMIT_PER_TYPE,
    hasQuery,
  );

  return (
    <PageContainer>
      <SectionHeader
        title="Search"
        description={
          hasQuery
            ? `Results for "${query}"`
            : "Search classes, announcements, assignments, materials, and more."
        }
      />

      {!hasQuery ? (
        <EmptyState
          icon={Search}
          title="Type something to search"
          description="Use the search bar above, or press Ctrl/Cmd + K, to find classes, announcements, assignments, materials, and topics."
        />
      ) : (
        <QueryView query={results} loading={<ListSkeleton rows={5} />}>
          {(data) => (
            <>
              <SearchTypeFilters
                query={query}
                activeType={activeType}
                countsByType={data.countsByType}
                totalCount={data.totalCount}
              />

              {data.totalCount === 0 ? (
                <EmptyState
                  icon={Search}
                  title={`No results for "${query}"`}
                  description="Try a different term, remove a filter, or check spelling and try again."
                />
              ) : activeType ? (
                <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2">
                  {data.items.map((item) => (
                    <SearchResultRow
                      key={`${item.entityType}-${item.id}`}
                      item={item}
                      query={query}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {SEARCH_ENTITY_TYPES.map((type) => {
                    const items = data.items.filter((item) => item.entityType === type);
                    if (items.length === 0) return null;
                    return (
                      <div key={type} className="flex flex-col gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {ENTITY_TYPE_LABEL_PLURAL[type]}
                        </h2>
                        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2">
                          {items.map((item) => (
                            <SearchResultRow
                              key={`${item.entityType}-${item.id}`}
                              item={item}
                              query={query}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </QueryView>
      )}
    </PageContainer>
  );
}
