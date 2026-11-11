import type { ClassroomStatus } from "@/generated/prisma/enums";

export type { ActionResult } from "@/types/action-result";

/**
 * Every content type the shared search infrastructure currently knows how
 * to search. Adding a new searchable entity means adding one function to
 * search-service.ts and one entry here - the rest of the pipeline (scoping,
 * merging, counting) is entity-agnostic.
 */
export type SearchEntityType =
  "classroom" | "announcement" | "assignment" | "material" | "topic" | "user";

export const SEARCH_ENTITY_TYPES: SearchEntityType[] = [
  "classroom",
  "announcement",
  "assignment",
  "material",
  "topic",
  "user",
];

/** One matched item, normalized to a common shape regardless of its underlying entity. */
export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  /** Primary label - a classroom title, an announcement's derived title, a user's name, etc. */
  title: string;
  /** Secondary line - a short snippet/subtitle, or null when there isn't one. */
  description: string | null;
  /** Where selecting this result should navigate to. */
  href: string;
  /** Null for entities that aren't classroom-scoped (e.g. a user). */
  classroomId: string | null;
  classroomTitle: string | null;
  updatedAt: Date;
}

export interface SearchFilters {
  query: string;
  /** Restrict to a subset of entity types - omit to search everything the viewer can see. */
  entityTypes?: SearchEntityType[];
  /** Max results per entity type (not a total cap) - keeps every type represented in mixed results. */
  limitPerType?: number;
}

export interface SearchResults {
  query: string;
  totalCount: number;
  items: SearchResultItem[];
  countsByType: Record<SearchEntityType, number>;
}

/**
 * Phase 15.2 - the richer, classroom-only search: any combination of a
 * name/code text query, a teacher name/email query, and a status filter
 * (e.g. "just archived classrooms", with no text query at all). Reuses the
 * same authorization scoping and SearchResultItem/SearchResults shapes as
 * the generic search() pipeline - this is an additional entry point, not a
 * parallel implementation.
 */
export interface ClassroomSearchFilters {
  /** Matches classroom name or code. */
  query?: string;
  /** Matches the owner's or any managing member's name/email. */
  teacherQuery?: string;
  /** Omit to include both Active and Archived classrooms. */
  status?: ClassroomStatus;
  limit?: number;
}

/**
 * Phase 15.3 - the richer, academic-content-only search: Assignments,
 * Announcements, Materials, and Topics, any combination of a text query,
 * a classroom filter, a status filter, and a date range. Reuses the same
 * authorization scoping and result shapes as the other search entry points.
 */
export type AcademicContentEntityType = Extract<
  SearchEntityType,
  "assignment" | "announcement" | "material" | "topic"
>;

export interface AcademicContentSearchFilters {
  query?: string;
  /** Restrict to a subset of the four academic content types - omit for all four. */
  entityTypes?: AcademicContentEntityType[];
  classroomId?: string;
  /**
   * A raw status string, validated per entity type internally (e.g. "CLOSED"
   * only ever matches assignments; it's silently ignored for the other three
   * types rather than erroring, since one status value can't be valid for
   * every entity type at once). Topics have no status concept and always
   * ignore this filter.
   */
  status?: string;
  /** ISO date strings - inclusive range over each item's updatedAt. */
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}
