import { cache } from "./tagged-cache";

/**
 * Cache tags - same hierarchy the Next.js app used, so every mutation
 * invalidates exactly what it did before:
 *
 * - ACADEMIC: every classroom-derived read (classroom pages AND the
 *   cross-classroom aggregates). Admin-side mutations that can touch any
 *   classroom (archive, moderation, user status) invalidate this.
 * - classroom(id): everything rendered under /classes/:id.
 * - assignment(id): submission data for one assignment.
 * - AGGREGATES: reads that span every classroom a user belongs to
 *   (dashboard, todo, calendar, review queue, class lists, search).
 * - ADMIN: admin console listings.
 * - TIMETABLE: weekly timetable slots, clashes and requests.
 * - SETTINGS: the singleton system settings row.
 * - user(id): the per-request session/user lookup for one account.
 */
export const CacheTags = {
  ACADEMIC: "academic",
  AGGREGATES: "aggregates",
  ADMIN: "admin",
  TIMETABLE: "timetable",
  SETTINGS: "settings",
  classroom: (classroomId: string) => `classroom:${classroomId}`,
  assignment: (assignmentId: string) => `assignment:${assignmentId}`,
  user: (userId: string) => `user:${userId}`,
} as const;

/**
 * TTLs, matching the cacheLife profiles of the old next.config.ts:
 * - CLASSROOM: per-classroom reads - other members' changes show up within a
 *   minute even without an explicit invalidation.
 * - LIVE: cross-classroom aggregates and admin listings - short-lived, since
 *   they also depend on the clock (due soon, overdue, today).
 */
export const CacheTtl = {
  CLASSROOM: 60_000,
  LIVE: 30_000,
  SESSION: 30_000,
  SETTINGS: 60 * 60_000,
} as const;

/** A change inside one classroom (its content, roster, settings or submissions). */
export function invalidateClassroom(...classroomIds: string[]): void {
  cache.invalidateTags(
    ...classroomIds.map((id) => CacheTags.classroom(id)),
    CacheTags.AGGREGATES,
    CacheTags.ADMIN,
  );
}

/** A change to one assignment's submissions (turn in, grade, return, private comments). */
export function invalidateAssignment(classroomId: string, assignmentId: string): void {
  cache.invalidateTags(CacheTags.assignment(assignmentId));
  invalidateClassroom(classroomId);
}

/**
 * A change that can affect any classroom's data at once - admin actions and
 * profile changes that show up in every roster/comment (avatar).
 */
export function invalidateAllAcademic(): void {
  cache.invalidateTags(CacheTags.ACADEMIC, CacheTags.ADMIN);
}

/** A change only visible in the admin console (security sessions, lock state, audit trail). */
export function invalidateAdmin(): void {
  cache.invalidateTags(CacheTags.ADMIN);
}

export function invalidateTimetable(): void {
  cache.invalidateTags(CacheTags.TIMETABLE, CacheTags.AGGREGATES, CacheTags.ADMIN);
}

export function invalidateSettings(): void {
  cache.invalidateTags(CacheTags.SETTINGS);
}

/** Session/profile data of one user changed (status, role, avatar, password). */
export function invalidateUser(...userIds: string[]): void {
  cache.invalidateTags(...userIds.map((id) => CacheTags.user(id)));
}
