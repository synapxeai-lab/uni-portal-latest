import type { UserRole, UserStatus } from "@portal/shared/enums";

export type { ActionResult } from "@/types/action-result";
export type { UserRole, UserStatus } from "@portal/shared/enums";

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  image: string | null;
  hasViewablePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserDetail extends AdminUserSummary {
  archivedAt: Date | null;
  emailVerified: Date | null;
  ownedClassroomCount: number;
  classroomMembershipCount: number;
}

export type UserSortField = "name" | "email" | "role" | "status" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface ListUsersParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortField?: UserSortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface UsersPage {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreatedUserResult {
  user: AdminUserSummary;
  temporaryPassword: string;
}

export interface ResetPasswordResult {
  temporaryPassword: string;
}
