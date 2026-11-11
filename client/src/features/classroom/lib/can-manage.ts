import { ClassroomMembershipRole, ClassroomStatus } from "@portal/shared/enums";

/** Whether this membership role can manage the classroom (edit/archive/post as teacher). */
export function canManageClassroom(role: ClassroomMembershipRole): boolean {
  return (
    role === ClassroomMembershipRole.OWNER ||
    role === ClassroomMembershipRole.TEACHER ||
    role === ClassroomMembershipRole.CO_TEACHER
  );
}

/** Whether this classroom currently accepts new or edited content - archived classrooms are read-only regardless of who's asking. */
export function isClassroomActive(status: ClassroomStatus): boolean {
  return status === ClassroomStatus.ACTIVE;
}

/**
 * The actual gate for showing/enabling any create/edit/delete control -
 * combines "does this role manage the classroom" with "is the classroom
 * currently editable." Reused by every page and component that decides
 * whether to render a compose box, a "+ Create" button, an Invite button,
 * or a per-item management menu, so archived-state handling lives in one
 * place instead of being re-derived at each call site. Server-side mutations
 * still enforce this independently (see assertClassroomActive in
 * classroom-service.ts) - this is the UI-facing half of the same rule.
 */
export function canModifyClassroom(
  role: ClassroomMembershipRole,
  status: ClassroomStatus,
): boolean {
  return canManageClassroom(role) && isClassroomActive(status);
}
