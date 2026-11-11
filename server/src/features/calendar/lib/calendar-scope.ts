import type { ClassroomSearchScope } from "@/features/classroom/services/classroom-service";

function narrowIds(ids: string[], classroomId: string | undefined): string[] {
  if (!classroomId) {
    return ids;
  }
  return ids.includes(classroomId) ? [classroomId] : [];
}

/**
 * Narrows a scope down to a single requested classroom, if it's actually in
 * scope (mirrors search's narrowToClassroom). Applied once in
 * calendar-service.getEvents() before fanning out to providers, so a
 * classroom-filtered calendar query hits the database with a single
 * classroom id instead of every classroom the viewer can see, then throwing
 * away everything that doesn't match after the fact.
 */
export function narrowScopeToClassroom(
  scope: ClassroomSearchScope,
  classroomId: string | undefined,
): ClassroomSearchScope {
  if (!classroomId) {
    return scope;
  }
  return {
    manageableClassroomIds: narrowIds(scope.manageableClassroomIds, classroomId),
    memberOnlyClassroomIds: narrowIds(scope.memberOnlyClassroomIds, classroomId),
  };
}
