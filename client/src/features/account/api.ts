import type { ChangePasswordInput } from "@portal/shared/auth";

import { useQuery } from "@tanstack/react-query";

import type { ActionResult } from "@portal/shared/action-result";

import { apiAction, apiGet } from "@/lib/api";
import { SESSION_QUERY_KEY } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

export function changePassword(input: Omit<ChangePasswordInput, "forced">) {
  return apiAction(
    "post",
    "/account/password",
    input,
    "Couldn't update your password. Please try again.",
  );
}

/** Same signature as the old Server Action (a useActionState form). */
export async function updateAvatarAction(
  _prevState: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const result = await apiAction(
    "post",
    "/account/avatar",
    formData,
    "Couldn't update your profile photo. Please try again.",
  );
  if (result.status === "success") {
    // The header avatar comes from the session.
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }
  return result;
}

export interface Profile {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export function useProfile() {
  return useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => apiGet<Profile>("/account/profile"),
  });
}
