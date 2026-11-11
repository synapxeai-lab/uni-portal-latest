import type { BadgeProps } from "@/components/ui/badge";
import { UserRole, UserStatus } from "@portal/shared/enums";

export const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  PENDING_PASSWORD_CHANGE: "Pending password change",
  ARCHIVED: "Archived",
  LOCKED: "Locked",
};

export const statusBadgeVariant: Record<UserStatus, NonNullable<BadgeProps["variant"]>> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
  PENDING_PASSWORD_CHANGE: "warning",
  ARCHIVED: "outline",
  LOCKED: "destructive",
};

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

export const roleBadgeVariant: Record<UserRole, NonNullable<BadgeProps["variant"]>> = {
  ADMIN: "default",
  TEACHER: "secondary",
  STUDENT: "outline",
};

export const roleOptions = [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT] as const;

// All statuses a user can be in, for the table's status filter dropdown.
export const allStatuses = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.PENDING_PASSWORD_CHANGE,
  UserStatus.ARCHIVED,
  UserStatus.LOCKED,
] as const;

// Statuses an admin can set directly via the status menu - PENDING_PASSWORD_CHANGE
// is only ever reached through the force-password-change action.
export const settableStatuses = [
  UserStatus.ACTIVE,
  UserStatus.INACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.ARCHIVED,
] as const;
