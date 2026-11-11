import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import type { MemberSortKey, SortDirection } from "../lib/roster-search-sort";

interface RosterControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortKey: MemberSortKey;
  onSortKeyChange: (value: MemberSortKey) => void;
  sortDir: SortDirection;
  onToggleSortDir: () => void;
}

export function RosterControls({
  search,
  onSearchChange,
  sortKey,
  onSortKeyChange,
  sortDir,
  onToggleSortDir,
}: RosterControlsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Label htmlFor="roster-search" className="sr-only">
          Search members by name or email
        </Label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="roster-search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="roster-sort" className="sr-only">
          Sort members
        </Label>
        <Select
          id="roster-sort"
          value={sortKey}
          onChange={(event) => onSortKeyChange(event.target.value as MemberSortKey)}
          className="sm:w-40"
        >
          <option value="name">Name</option>
          <option value="joinedAt">Date joined</option>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleSortDir}
          aria-label={
            sortDir === "asc"
              ? "Currently sorted ascending, click to sort descending"
              : "Currently sorted descending, click to sort ascending"
          }
        >
          {sortDir === "asc" ? (
            <ArrowDownAZ className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowUpAZ className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
