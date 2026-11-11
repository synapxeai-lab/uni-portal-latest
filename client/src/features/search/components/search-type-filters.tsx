import Link from "@/components/ui/link";

import { cn } from "@/lib/utils";

import { ENTITY_TYPE_LABEL_PLURAL } from "../lib/search-display";
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from "../types";

interface SearchTypeFiltersProps {
  query: string;
  activeType?: SearchEntityType;
  countsByType: Record<SearchEntityType, number>;
  totalCount: number;
}

/** Filter chips for the /search results page - reads/writes the `type` query param, reusing the same `q`. */
export function SearchTypeFilters({
  query,
  activeType,
  countsByType,
  totalCount,
}: SearchTypeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        href={`/search?q=${encodeURIComponent(query)}`}
        label="All"
        count={totalCount}
        active={!activeType}
      />
      {SEARCH_ENTITY_TYPES.map((type) => (
        <FilterChip
          key={type}
          href={`/search?q=${encodeURIComponent(query)}&type=${type}`}
          label={ENTITY_TYPE_LABEL_PLURAL[type]}
          count={countsByType[type]}
          active={activeType === type}
        />
      ))}
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-gold bg-gold-soft text-gold-foreground dark:text-gold"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "text-xs",
          active ? "text-gold-foreground dark:text-gold" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
