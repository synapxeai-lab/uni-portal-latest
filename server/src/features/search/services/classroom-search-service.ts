import type { SessionUser } from "@/auth/session";
import { getClassroomSearchScope } from "@/features/classroom/services/classroom-service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ClassroomMembershipRole, ClassroomMembershipStatus } from "@/generated/prisma/enums";

import { DEFAULT_LIMIT_PER_TYPE } from "../lib/search-constants";
import { isSearchableQuery, normalizeQuery } from "../lib/search-text";
import type { ClassroomSearchFilters, SearchResultItem, SearchResults } from "../types";
import { emptyCounts, emptyResults } from "./search-service";

const MANAGING_ROLES: ClassroomMembershipRole[] = [
  ClassroomMembershipRole.OWNER,
  ClassroomMembershipRole.TEACHER,
  ClassroomMembershipRole.CO_TEACHER,
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
};

/**
 * The richer, classroom-only search (Phase 15.2) - supports any combination
 * of a name/code text query, a teacher name/email query, and a status
 * filter (including "just Archived classrooms" with no text query at all).
 * Reuses getClassroomSearchScope (the same authorization primitive the
 * generic search() pipeline uses) so the role rules stay identical:
 * Students only see classrooms they've joined, Teachers only see classrooms
 * they manage or belong to, Admins see every classroom platform-wide.
 * Archived classrooms are included by default (scope already covers them) -
 * they only disappear if the caller explicitly filters status to Active.
 */
export async function searchClassroomsDetailed(
  user: SessionUser,
  filters: ClassroomSearchFilters,
): Promise<SearchResults> {
  const query = filters.query ? normalizeQuery(filters.query) : "";
  const teacherQuery = filters.teacherQuery ? normalizeQuery(filters.teacherQuery) : "";
  const hasQuery = isSearchableQuery(query);
  const hasTeacherQuery = isSearchableQuery(teacherQuery);

  // Requires at least one real filter - otherwise this would be a full,
  // unfiltered dump of every classroom the viewer can see.
  if (!hasQuery && !hasTeacherQuery && !filters.status) {
    return emptyResults("");
  }

  const scope = await getClassroomSearchScope(user);
  const allIds = [...scope.manageableClassroomIds, ...scope.memberOnlyClassroomIds];
  if (allIds.length === 0) {
    return emptyResults("");
  }

  const limit = filters.limit ?? DEFAULT_LIMIT_PER_TYPE;

  const andConditions: Prisma.ClassroomWhereInput[] = [];

  if (hasQuery) {
    andConditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (hasTeacherQuery) {
    andConditions.push({
      OR: [
        {
          owner: {
            OR: [
              { name: { contains: teacherQuery, mode: "insensitive" } },
              { email: { contains: teacherQuery, mode: "insensitive" } },
            ],
          },
        },
        {
          memberships: {
            some: {
              status: ClassroomMembershipStatus.ACTIVE,
              role: { in: MANAGING_ROLES },
              user: {
                OR: [
                  { name: { contains: teacherQuery, mode: "insensitive" } },
                  { email: { contains: teacherQuery, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  const classrooms = await prisma.classroom.findMany({
    where: {
      id: { in: allIds },
      ...(filters.status ? { status: filters.status } : {}),
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    },
    select: {
      id: true,
      title: true,
      section: true,
      subject: true,
      code: true,
      status: true,
      owner: { select: { name: true } },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const items: SearchResultItem[] = classrooms.map((classroom) => ({
    id: classroom.id,
    entityType: "classroom",
    title: classroom.title,
    description: [
      classroom.subject,
      classroom.code,
      `Taught by ${classroom.owner.name}`,
      STATUS_LABEL[classroom.status] ?? classroom.status,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/classes/${classroom.id}/stream`,
    classroomId: classroom.id,
    classroomTitle: classroom.title,
    updatedAt: classroom.updatedAt,
  }));

  const countsByType = emptyCounts();
  countsByType.classroom = items.length;

  return { query: query || teacherQuery, totalCount: items.length, items, countsByType };
}
