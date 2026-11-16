import { FilterPills, SearchBox } from "@/components/classic/classic";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useProgrammeCategories } from "@/features/academics/api";
import { useRouter, useSearchParams } from "@/lib/navigation";

import type { ClassroomSummary } from "../types";

/**
 * Filters for the Classes page (admins and teachers): programme pills, then
 * diploma, batch, section and teacher dropdowns and a search box. Each one
 * lives in the address, so Back and refresh keep them.
 */
export interface ClassFilters {
  programme: string;
  diploma: string;
  batch: string;
  section: string;
  teacher: string;
  q: string;
}

/** Classrooms that aren't a university course's (e.g. a class made by hand). */
const OTHER = "OTHER";
const KEYS = ["programme", "diploma", "batch", "section", "teacher", "q"] as const;

const shortProgrammeLabel = (label: string) => label.replace(/ Programmes?$/i, "");
const unique = (values: string[]) => [...new Set(values)];

export function useClassFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])) as unknown as ClassFilters;

  /** Changing a level clears the ones below it (a new programme resets the diploma, and so on). */
  const set = (key: keyof ClassFilters, value: string) => {
    const next = { ...filters, [key]: value };
    const order: (keyof ClassFilters)[] = ["programme", "diploma", "batch", "section"];
    const level = order.indexOf(key);
    if (level !== -1) order.slice(level + 1).forEach((k) => (next[k] = ""));
    const search = new URLSearchParams();
    KEYS.forEach((k) => next[k] && search.set(k, next[k]));
    const qs = search.toString();
    router.replace(qs ? `/classes?${qs}` : "/classes", { scroll: false });
  };
  const clear = () => router.replace("/classes", { scroll: false });
  return { filters, set, clear };
}

/** The classes matching every filter but `except` (each dropdown's options ignore its own choice). */
function matching(list: ClassroomSummary[], filters: ClassFilters, except?: keyof ClassFilters) {
  const on = (key: keyof ClassFilters) => key !== except && filters[key] !== "";
  const term = filters.q.trim().toLowerCase();
  return list.filter((c) => {
    const o = c.offering;
    if (on("programme") && (filters.programme === OTHER ? o !== null : o?.programme !== filters.programme)) return false;
    if (on("diploma") && String(o?.diploma.id) !== filters.diploma) return false;
    if (on("batch") && o?.batch !== filters.batch) return false;
    if (on("section") && o?.sectionLabel !== filters.section) return false;
    if (on("teacher") && c.ownerName !== filters.teacher) return false;
    if (on("q") && term) {
      const text = `${c.title} ${c.section} ${o?.course.code ?? ""} ${o?.course.name ?? ""}`.toLowerCase();
      if (!text.includes(term)) return false;
    }
    return true;
  });
}

export const filterClasses = (list: ClassroomSummary[], filters: ClassFilters) => matching(list, filters);

export interface DiplomaGroup {
  key: string;
  /** "DTM · Diploma in Tourism Management", or "Other classes" for classes outside any course. */
  title: string;
  classes: ClassroomSummary[];
}

/** Classes grouped under their diploma, in diploma-code order, with "Other classes" last. */
export function groupByDiploma(list: ClassroomSummary[]): DiplomaGroup[] {
  const groups = new Map<string, DiplomaGroup & { code: string }>();
  for (const c of list) {
    const d = c.offering?.diploma;
    const key = d ? String(d.id) : OTHER;
    let group = groups.get(key);
    if (!group) {
      group = { key, code: d?.code ?? "", title: d ? `${d.code} · ${d.name}` : "Other classes", classes: [] };
      groups.set(key, group);
    }
    group.classes.push(c);
  }
  return [...groups.values()]
    .sort((a, b) => (a.key === OTHER ? 1 : b.key === OTHER ? -1 : a.code.localeCompare(b.code)))
    .map(({ code: _code, ...group }) => ({ ...group, classes: group.classes.sort(byCohort) }));
}

/** Newest batch first, then section, then course name. */
function byCohort(a: ClassroomSummary, b: ClassroomSummary) {
  return (
    (b.offering?.batch ?? "").localeCompare(a.offering?.batch ?? "", undefined, { numeric: true }) ||
    (a.offering?.sectionLabel ?? "").localeCompare(b.offering?.sectionLabel ?? "") ||
    a.title.localeCompare(b.title)
  );
}

export function ClassesFilters({
  list,
  filters,
  onChange,
  onClear,
  shown,
  showTeacher,
}: {
  list: ClassroomSummary[];
  filters: ClassFilters;
  onChange: (key: keyof ClassFilters, value: string) => void;
  onClear: () => void;
  shown: number;
  /** Admins only: a teacher's list is their own classes, so there's nobody else to pick. */
  showTeacher: boolean;
}) {
  const categories = useProgrammeCategories().data?.categories ?? [];

  // Programme pills: every programme (even one with no classes yet), in the portal's order,
  // plus "Other" for classes outside any course.
  const forProgramme = matching(list, filters, "programme");
  const known = new Set(categories.map((c) => c.key));
  const programmes = [
    ...categories.map((c) => ({ key: c.key, label: shortProgrammeLabel(c.label) })),
    ...unique(list.flatMap((c) => (c.offering && !known.has(c.offering.programme) ? [c.offering.programme] : []))).map((key) => ({
      key,
      label: key,
    })),
  ];
  const hasOther = list.some((c) => !c.offering);
  const programmeOptions = [
    { value: "", label: "All", count: forProgramme.length },
    ...programmes.map(({ key, label }) => ({
      value: key,
      label,
      count: forProgramme.filter((c) => c.offering?.programme === key).length,
    })),
    ...(hasOther ? [{ value: OTHER, label: "Other", count: forProgramme.filter((c) => !c.offering).length }] : []),
  ];

  const diplomas = new Map(
    matching(list, filters, "diploma").flatMap((c) => (c.offering ? [[String(c.offering.diploma.id), c.offering.diploma]] : [])),
  );
  const batches = unique(matching(list, filters, "batch").flatMap((c) => (c.offering ? [c.offering.batch] : []))).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true }),
  );
  const sections = unique(matching(list, filters, "section").flatMap((c) => (c.offering ? [c.offering.sectionLabel] : []))).sort();
  const teachers = unique(matching(list, filters, "teacher").map((c) => c.ownerName)).sort();
  const universityOnly = filters.programme === OTHER;
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <FilterPills label="Programme" value={filters.programme} onChange={(v) => onChange("programme", v)} options={programmeOptions} />
      <div className={showTeacher ? "grid grid-cols-2 gap-3 lg:grid-cols-4" : "grid grid-cols-2 gap-3 lg:grid-cols-3"}>
        <FilterSelect
          id="classes-diploma"
          label="Diploma"
          value={filters.diploma}
          disabled={universityOnly}
          onChange={(v) => onChange("diploma", v)}
          options={[...diplomas.entries()]
            .sort((a, b) => a[1].code.localeCompare(b[1].code))
            .map(([id, d]) => ({ value: id, label: `${d.code} · ${d.name}` }))}
        />
        <FilterSelect
          id="classes-batch"
          label="Batch"
          value={filters.batch}
          disabled={universityOnly}
          onChange={(v) => onChange("batch", v)}
          options={batches.map((b) => ({ value: b, label: b }))}
        />
        <FilterSelect
          id="classes-section"
          label="Section"
          value={filters.section}
          disabled={universityOnly}
          onChange={(v) => onChange("section", v)}
          options={sections.map((s) => ({ value: s, label: `Section ${s}` }))}
        />
        {showTeacher ? (
          <FilterSelect
            id="classes-teacher"
            label="Teacher"
            value={filters.teacher}
            onChange={(v) => onChange("teacher", v)}
            options={teachers.map((t) => ({ value: t, label: t }))}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={filters.q} onChange={(v) => onChange("q", v)} placeholder="Search by class or course" />
        <span className="text-sm text-muted-foreground">
          Showing {shown} of {list.length} class{list.length === 1 ? "" : "es"}
        </span>
        {active ? (
          <button type="button" onClick={onClear} className="text-sm font-medium text-link">
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
