import type { SessionUser } from "@/auth/session";
import {
  getClassroomSearchScope,
  type ClassroomSearchScope,
} from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  AnnouncementStatus,
  AssignmentStatus,
  MaterialStatus,
  UserRole,
} from "@/generated/prisma/enums";

import { DEFAULT_LIMIT_PER_TYPE } from "../lib/search-constants";
import { isSearchableQuery, normalizeQuery, truncateSnippet } from "../lib/search-text";
import type { SearchEntityType, SearchFilters, SearchResultItem, SearchResults } from "../types";

export function hasAnyScope(scope: ClassroomSearchScope): boolean {
  return scope.manageableClassroomIds.length > 0 || scope.memberOnlyClassroomIds.length > 0;
}

/** Narrows a scope's classroom ids to a single one, if requested and actually in scope - used by the richer per-entity search entry points (Phase 15.2/15.3) that support a classroom filter. */
export function narrowToClassroom(ids: string[], classroomId: string | undefined): string[] {
  if (!classroomId) {
    return ids;
  }
  return ids.includes(classroomId) ? [classroomId] : [];
}

/** Shared optional filters every content-search function below accepts, beyond the base classroom-visibility scoping. */
export interface ContentSearchOptions {
  /** Omit to skip title/content text matching entirely (e.g. "browse by classroom + date only"). */
  query?: string;
  classroomId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
}

function dateRangeCondition(options: ContentSearchOptions): Prisma.DateTimeFilter | undefined {
  if (!options.dateFrom && !options.dateTo) {
    return undefined;
  }
  return {
    ...(options.dateFrom ? { gte: options.dateFrom } : {}),
    ...(options.dateTo ? { lte: options.dateTo } : {}),
  };
}

async function searchClassrooms(
  scope: ClassroomSearchScope,
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const allIds = [...scope.manageableClassroomIds, ...scope.memberOnlyClassroomIds];
  if (allIds.length === 0) {
    return [];
  }

  const classrooms = await prisma.classroom.findMany({
    where: {
      id: { in: allIds },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { section: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, section: true, subject: true, code: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return classrooms.map((classroom) => ({
    id: classroom.id,
    entityType: "classroom" as const,
    title: classroom.title,
    description:
      [classroom.subject, classroom.section, classroom.code].filter(Boolean).join(" · ") || null,
    href: `/classes/${classroom.id}/stream`,
    classroomId: classroom.id,
    classroomTitle: classroom.title,
    updatedAt: classroom.updatedAt,
  }));
}

/**
 * Same per-classroom visibility split every content query below relies on:
 * classrooms the viewer manages are fully visible (drafts/scheduled
 * included, or narrowed to an explicitly requested status), classrooms
 * they're only a plain member of are restricted to whatever "published"
 * status(es) that role is allowed to see - exactly the same rule each
 * feature's own listClassroomX() query already enforces for a single
 * classroom, just applied across every classroom the viewer can see (and
 * optionally narrowed further by classroom/status/date) in one query.
 *
 * `query` is optional here (unlike the top-level search() entry point,
 * which always requires one) so the richer per-entity search endpoints
 * (Phase 15.2 classrooms, Phase 15.3 academic content) can browse by
 * classroom/status/date alone, with no text at all.
 */
export async function searchAnnouncements(
  scope: ClassroomSearchScope,
  options: ContentSearchOptions & { status?: AnnouncementStatus },
): Promise<SearchResultItem[]> {
  if (!hasAnyScope(scope)) {
    return [];
  }

  const manageableIds = narrowToClassroom(scope.manageableClassroomIds, options.classroomId);
  const memberOnlyIds = narrowToClassroom(scope.memberOnlyClassroomIds, options.classroomId);

  const visibilityOr: Prisma.AnnouncementWhereInput[] = [];
  if (manageableIds.length > 0) {
    visibilityOr.push({
      classroomId: { in: manageableIds },
      ...(options.status ? { status: options.status } : {}),
    });
  }
  if (
    memberOnlyIds.length > 0 &&
    (!options.status || options.status === AnnouncementStatus.PUBLISHED)
  ) {
    visibilityOr.push({ classroomId: { in: memberOnlyIds }, status: AnnouncementStatus.PUBLISHED });
  }
  if (visibilityOr.length === 0) {
    return [];
  }

  const andConditions: Prisma.AnnouncementWhereInput[] = [];
  if (options.query) {
    andConditions.push({
      OR: [
        { title: { contains: options.query, mode: "insensitive" } },
        { content: { contains: options.query, mode: "insensitive" } },
      ],
    });
  }
  const dateRange = dateRangeCondition(options);
  if (dateRange) {
    andConditions.push({ updatedAt: dateRange });
  }

  const announcements = await prisma.announcement.findMany({
    where: {
      deletedAt: null,
      OR: visibilityOr,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    select: {
      id: true,
      title: true,
      content: true,
      classroomId: true,
      classroom: { select: { title: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit,
  });

  return announcements.map((announcement) => ({
    id: announcement.id,
    entityType: "announcement" as const,
    title: announcement.title,
    description: truncateSnippet(announcement.content),
    href: `/classes/${announcement.classroomId}/stream`,
    classroomId: announcement.classroomId,
    classroomTitle: announcement.classroom.title,
    updatedAt: announcement.updatedAt,
  }));
}

const ASSIGNMENT_MEMBER_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PUBLISHED,
  AssignmentStatus.CLOSED,
];

export async function searchAssignments(
  scope: ClassroomSearchScope,
  options: ContentSearchOptions & { status?: AssignmentStatus },
): Promise<SearchResultItem[]> {
  if (!hasAnyScope(scope)) {
    return [];
  }

  const manageableIds = narrowToClassroom(scope.manageableClassroomIds, options.classroomId);
  const memberOnlyIds = narrowToClassroom(scope.memberOnlyClassroomIds, options.classroomId);

  const visibilityOr: Prisma.AssignmentWhereInput[] = [];
  if (manageableIds.length > 0) {
    visibilityOr.push({
      classroomId: { in: manageableIds },
      ...(options.status ? { status: options.status } : {}),
    });
  }
  if (
    memberOnlyIds.length > 0 &&
    (!options.status || ASSIGNMENT_MEMBER_STATUSES.includes(options.status))
  ) {
    visibilityOr.push({
      classroomId: { in: memberOnlyIds },
      status: options.status ? options.status : { in: ASSIGNMENT_MEMBER_STATUSES },
    });
  }
  if (visibilityOr.length === 0) {
    return [];
  }

  const andConditions: Prisma.AssignmentWhereInput[] = [];
  if (options.query) {
    andConditions.push({
      OR: [
        { title: { contains: options.query, mode: "insensitive" } },
        { description: { contains: options.query, mode: "insensitive" } },
      ],
    });
  }
  const dateRange = dateRangeCondition(options);
  if (dateRange) {
    andConditions.push({ updatedAt: dateRange });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      OR: visibilityOr,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      classroomId: true,
      classroom: { select: { title: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit,
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    entityType: "assignment" as const,
    title: assignment.title,
    description: assignment.description ? truncateSnippet(assignment.description) : null,
    href: `/classes/${assignment.classroomId}/classwork/${assignment.id}`,
    classroomId: assignment.classroomId,
    classroomTitle: assignment.classroom.title,
    updatedAt: assignment.updatedAt,
  }));
}

export async function searchMaterials(
  scope: ClassroomSearchScope,
  options: ContentSearchOptions & { status?: MaterialStatus },
): Promise<SearchResultItem[]> {
  if (!hasAnyScope(scope)) {
    return [];
  }

  const manageableIds = narrowToClassroom(scope.manageableClassroomIds, options.classroomId);
  const memberOnlyIds = narrowToClassroom(scope.memberOnlyClassroomIds, options.classroomId);

  const visibilityOr: Prisma.MaterialWhereInput[] = [];
  if (manageableIds.length > 0) {
    visibilityOr.push({
      classroomId: { in: manageableIds },
      ...(options.status ? { status: options.status } : {}),
    });
  }
  if (
    memberOnlyIds.length > 0 &&
    (!options.status || options.status === MaterialStatus.PUBLISHED)
  ) {
    visibilityOr.push({ classroomId: { in: memberOnlyIds }, status: MaterialStatus.PUBLISHED });
  }
  if (visibilityOr.length === 0) {
    return [];
  }

  const andConditions: Prisma.MaterialWhereInput[] = [];
  if (options.query) {
    andConditions.push({
      OR: [
        { title: { contains: options.query, mode: "insensitive" } },
        { description: { contains: options.query, mode: "insensitive" } },
      ],
    });
  }
  const dateRange = dateRangeCondition(options);
  if (dateRange) {
    andConditions.push({ updatedAt: dateRange });
  }

  const materials = await prisma.material.findMany({
    where: {
      deletedAt: null,
      OR: visibilityOr,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      classroomId: true,
      classroom: { select: { title: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit,
  });

  return materials.map((material) => ({
    id: material.id,
    entityType: "material" as const,
    title: material.title,
    description: material.description ? truncateSnippet(material.description) : null,
    href: `/classes/${material.classroomId}/classwork`,
    classroomId: material.classroomId,
    classroomTitle: material.classroom.title,
    updatedAt: material.updatedAt,
  }));
}

/**
 * Topics have no publish/draft concept of their own (see topic-service.ts's
 * listClassroomTopics) - any active member of a classroom sees every topic
 * in it, so unlike the other three content types there's no status split
 * between the manageable and member-only branches, just classroom scoping.
 */
export async function searchTopics(
  scope: ClassroomSearchScope,
  options: ContentSearchOptions,
): Promise<SearchResultItem[]> {
  if (!hasAnyScope(scope)) {
    return [];
  }

  const allIds = [
    ...narrowToClassroom(scope.manageableClassroomIds, options.classroomId),
    ...narrowToClassroom(scope.memberOnlyClassroomIds, options.classroomId),
  ];
  if (allIds.length === 0) {
    return [];
  }

  const andConditions: Prisma.TopicWhereInput[] = [];
  if (options.query) {
    andConditions.push({ title: { contains: options.query, mode: "insensitive" } });
  }
  const dateRange = dateRangeCondition(options);
  if (dateRange) {
    andConditions.push({ updatedAt: dateRange });
  }

  const topics = await prisma.topic.findMany({
    where: {
      deletedAt: null,
      classroomId: { in: allIds },
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    select: {
      id: true,
      title: true,
      classroomId: true,
      classroom: { select: { title: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit,
  });

  return topics.map((topic) => ({
    id: topic.id,
    entityType: "topic" as const,
    title: topic.title,
    description: null,
    href: `/classes/${topic.classroomId}/classwork`,
    classroomId: topic.classroomId,
    classroomTitle: topic.classroom.title,
    updatedAt: topic.updatedAt,
  }));
}

/** Admin-only - name/email search across every account on the platform. */
async function searchUsers(
  user: SessionUser,
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  if (user.role !== UserRole.ADMIN) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return users.map((row) => ({
    id: row.id,
    entityType: "user" as const,
    title: row.name,
    description: row.email,
    href: `/admin/users?q=${encodeURIComponent(row.email)}`,
    classroomId: null,
    classroomTitle: null,
    updatedAt: row.updatedAt,
  }));
}

export function emptyCounts(): Record<SearchEntityType, number> {
  return { classroom: 0, announcement: 0, assignment: 0, material: 0, topic: 0, user: 0 };
}

export function emptyResults(query: string): SearchResults {
  return { query, totalCount: 0, items: [], countsByType: emptyCounts() };
}

/**
 * The single entry point for cross-application search - authorization-aware
 * (every branch is scoped to what `user` can actually see, computed once via
 * getClassroomSearchScope rather than per entity type), and pluggable (each
 * entity type is one independent, bounded, indexed query, run in parallel).
 * Below MIN_QUERY_LENGTH this returns an empty result set without touching
 * the database at all, so a caller can invoke this on every keystroke
 * without worrying about the trivial-query case being expensive.
 */
export async function search(user: SessionUser, filters: SearchFilters): Promise<SearchResults> {
  const query = normalizeQuery(filters.query);

  if (!isSearchableQuery(query)) {
    return emptyResults(query);
  }

  const limit = filters.limitPerType ?? DEFAULT_LIMIT_PER_TYPE;
  const requestedTypes = new Set(filters.entityTypes ?? []);
  const wants = (type: SearchEntityType) => requestedTypes.size === 0 || requestedTypes.has(type);

  const scope = await getClassroomSearchScope(user);

  const [classrooms, announcements, assignments, materials, topics, users] = await Promise.all([
    wants("classroom") ? searchClassrooms(scope, query, limit) : Promise.resolve([]),
    wants("announcement") ? searchAnnouncements(scope, { query, limit }) : Promise.resolve([]),
    wants("assignment") ? searchAssignments(scope, { query, limit }) : Promise.resolve([]),
    wants("material") ? searchMaterials(scope, { query, limit }) : Promise.resolve([]),
    wants("topic") ? searchTopics(scope, { query, limit }) : Promise.resolve([]),
    wants("user") ? searchUsers(user, query, limit) : Promise.resolve([]),
  ]);

  const items = [
    ...classrooms,
    ...announcements,
    ...assignments,
    ...materials,
    ...topics,
    ...users,
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const countsByType = emptyCounts();
  countsByType.classroom = classrooms.length;
  countsByType.announcement = announcements.length;
  countsByType.assignment = assignments.length;
  countsByType.material = materials.length;
  countsByType.topic = topics.length;
  countsByType.user = users.length;

  return { query, totalCount: items.length, items, countsByType };
}
