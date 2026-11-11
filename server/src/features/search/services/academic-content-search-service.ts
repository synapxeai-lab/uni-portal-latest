import type { SessionUser } from "@/auth/session";
import { getClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { AnnouncementStatus, AssignmentStatus, MaterialStatus } from "@/generated/prisma/enums";

import { DEFAULT_LIMIT_PER_TYPE } from "../lib/search-constants";
import { isSearchableQuery, normalizeQuery } from "../lib/search-text";
import type {
  AcademicContentEntityType,
  AcademicContentSearchFilters,
  SearchEntityType,
  SearchResults,
} from "../types";
import {
  emptyCounts,
  emptyResults,
  searchAnnouncements,
  searchAssignments,
  searchMaterials,
  searchTopics,
  type ContentSearchOptions,
} from "./search-service";

/** Only applies `status` if it's actually a valid value of the given enum - otherwise the filter is silently dropped for that entity type. */
function matchingStatus<T extends string>(
  status: string | undefined,
  values: readonly T[],
): T | undefined {
  return status && (values as readonly string[]).includes(status) ? (status as T) : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The richer, academic-content-only search (Phase 15.3): Assignments,
 * Announcements, Materials, and Topics, filterable by classroom, status,
 * and a date range, with the text query itself now optional (unlike the
 * generic search() entry point) so a caller can browse "everything due/
 * posted in this classroom this month" with no text at all. Reuses
 * getClassroomSearchScope for authorization and the same per-entity search
 * functions the generic pipeline already calls - just with more of their
 * (already-supported) optional filters populated.
 */
export async function searchAcademicContent(
  user: SessionUser,
  filters: AcademicContentSearchFilters,
): Promise<SearchResults> {
  const query = filters.query ? normalizeQuery(filters.query) : "";
  const hasQuery = isSearchableQuery(query);
  const dateFrom = parseDate(filters.dateFrom);
  const dateTo = parseDate(filters.dateTo);

  // Requires at least one real filter - otherwise this would be an
  // unfiltered dump of every academic content item the viewer can see.
  if (!hasQuery && !filters.classroomId && !filters.status && !dateFrom && !dateTo) {
    return emptyResults(query);
  }

  const scope = await getClassroomSearchScope(user);
  const limit = filters.limit ?? DEFAULT_LIMIT_PER_TYPE;
  const requestedTypes = new Set<AcademicContentEntityType>(filters.entityTypes ?? []);
  const wants = (type: AcademicContentEntityType) =>
    requestedTypes.size === 0 || requestedTypes.has(type);

  const baseOptions: ContentSearchOptions = {
    query: hasQuery ? query : undefined,
    classroomId: filters.classroomId,
    dateFrom,
    dateTo,
    limit,
  };

  const [announcements, assignments, materials, topics] = await Promise.all([
    wants("announcement")
      ? searchAnnouncements(scope, {
          ...baseOptions,
          status: matchingStatus(filters.status, Object.values(AnnouncementStatus)),
        })
      : Promise.resolve([]),
    wants("assignment")
      ? searchAssignments(scope, {
          ...baseOptions,
          status: matchingStatus(filters.status, Object.values(AssignmentStatus)),
        })
      : Promise.resolve([]),
    wants("material")
      ? searchMaterials(scope, {
          ...baseOptions,
          status: matchingStatus(filters.status, Object.values(MaterialStatus)),
        })
      : Promise.resolve([]),
    // Topics have no status concept - the filter is simply not passed through.
    wants("topic") ? searchTopics(scope, baseOptions) : Promise.resolve([]),
  ]);

  const items = [...announcements, ...assignments, ...materials, ...topics].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  const countsByType: Record<SearchEntityType, number> = emptyCounts();
  countsByType.announcement = announcements.length;
  countsByType.assignment = assignments.length;
  countsByType.material = materials.length;
  countsByType.topic = topics.length;

  return { query, totalCount: items.length, items, countsByType };
}
