import Link from "@/components/ui/link";

import { ENTITY_TYPE_ICON } from "../lib/search-display";
import type { SearchResultItem } from "../types";
import { HighlightMatch } from "./highlight-match";

interface SearchResultRowProps {
  item: SearchResultItem;
  query: string;
  onClick?: () => void;
}

/** One result row - shared by the search dialog and the full /search results page, so the two surfaces render identically. */
export function SearchResultRow({ item, query, onClick }: SearchResultRowProps) {
  const Icon = ENTITY_TYPE_ICON[item.entityType];

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="flex items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          <HighlightMatch text={item.title} query={query} />
        </span>
        {item.description ? (
          <span className="truncate text-xs text-muted-foreground">
            <HighlightMatch text={item.description} query={query} />
          </span>
        ) : null}
        {item.classroomTitle && item.classroomTitle !== item.title ? (
          <span className="truncate text-xs text-muted-foreground">{item.classroomTitle}</span>
        ) : null}
      </div>
    </Link>
  );
}
