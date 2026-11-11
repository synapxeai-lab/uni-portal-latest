import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiAction, apiGet, formDataToObject } from "@/lib/api";

import type {
  ActionResult,
  AdminUserDetail,
  AdminUserSummary,
  CreatedUserResult,
  ResetPasswordResult,
  UsersPage,
} from "./types";

/** The users table for the current URL filters (kept on screen while the next page loads). */
export function useUsersPage(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => apiGet<UsersPage>(`/admin/users${search}`),
    placeholderData: keepPreviousData,
  });
}

// ---- Same signatures as the old Server Actions ------------------------------------
// Components call router.refresh() after a success, which refetches the table.

export function getUserDetailAction(userId: string): Promise<AdminUserDetail> {
  return apiGet<AdminUserDetail>(`/admin/users/${userId}`);
}

export function createUserAction(
  _prevState: ActionResult<CreatedUserResult> | null,
  formData: FormData,
): Promise<ActionResult<CreatedUserResult>> {
  return apiAction<CreatedUserResult>(
    "post",
    "/admin/users",
    formDataToObject(formData),
    "Couldn't create the user. Please try again.",
  );
}

export function updateUserAction(
  _prevState: ActionResult<AdminUserSummary> | null,
  formData: FormData,
): Promise<ActionResult<AdminUserSummary>> {
  const { userId, ...body } = formDataToObject(formData);
  return apiAction<AdminUserSummary>(
    "patch",
    `/admin/users/${userId}`,
    body,
    "Couldn't update the user. Please try again.",
  );
}

export function setUserStatusAction(userId: string, status: string) {
  return apiAction<AdminUserSummary>(
    "post",
    `/admin/users/${userId}/status`,
    { status },
    "Couldn't update this user's status. Please try again.",
  );
}

export function resetPasswordAction(userId: string) {
  return apiAction<ResetPasswordResult>(
    "post",
    `/admin/users/${userId}/reset-password`,
    undefined,
    "Couldn't reset this user's password. Please try again.",
  );
}

export function forcePasswordChangeAction(userId: string) {
  return apiAction(
    "post",
    `/admin/users/${userId}/force-password-change`,
    undefined,
    "Couldn't force a password change for this user. Please try again.",
  );
}

/** A user's current password (the admin-viewable copy); null when none is stored. */
export function viewPasswordAction(userId: string): Promise<{ password: string | null }> {
  return apiGet<{ password: string | null }>(`/admin/users/${userId}/password`);
}
