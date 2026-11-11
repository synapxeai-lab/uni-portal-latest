import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ReportSelectFilter {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface ReportNumberFilter {
  param: string;
  label: string;
  defaultValue: number;
}

interface ReportFilterBarProps {
  searchPlaceholder?: string;
  selectFilters?: ReportSelectFilter[];
  numberFilter?: ReportNumberFilter;
}

export function ReportFilterBar({
  searchPlaceholder = "Search…",
  selectFilters = [],
  numberFilter,
}: ReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [minDays, setMinDays] = useState(
    searchParams.get(numberFilter?.param ?? "") ?? String(numberFilter?.defaultValue ?? ""),
  );
  const debouncedMinDays = useDebouncedValue(minDays, 300);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    // Changing a filter invalidates whatever page the user was on - harmless
    // no-op for callers (like the reports pages) that have no pagination.
    params.delete("page");

    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debouncedSearch === (searchParams.get("q") ?? "")) {
      return;
    }
    updateParams({ q: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (!numberFilter) {
      return;
    }
    const current = searchParams.get(numberFilter.param) ?? String(numberFilter.defaultValue);
    if (debouncedMinDays === current) {
      return;
    }
    updateParams({ [numberFilter.param]: debouncedMinDays || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMinDays]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {selectFilters.map((filter) => (
        <Select
          key={filter.param}
          aria-label={filter.label}
          value={searchParams.get(filter.param) ?? ""}
          onChange={(event) => updateParams({ [filter.param]: event.target.value || null })}
          className="sm:w-48"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}
      {numberFilter ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {numberFilter.label}
          <Input
            type="number"
            min={0}
            value={minDays}
            onChange={(event) => setMinDays(event.target.value)}
            className="w-20"
          />
        </label>
      ) : null}
    </div>
  );
}
