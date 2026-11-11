import { useQuery } from "@tanstack/react-query";

import { apiAction, apiGet, formDataToObject } from "@/lib/api";
import { SESSION_QUERY_KEY } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import type { SystemSettings } from "@/lib/system-settings";
import type { ActionResult } from "@/types/action-result";

export const SETTINGS_QUERY_KEY = ["admin", "settings"] as const;

export function useSystemSettings(enabled: boolean) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => apiGet<SystemSettings>("/admin/settings"),
    enabled,
  });
}

/** Same signature as the old Server Action (a useActionState form). */
export async function updateSettingsAction(
  _prevState: ActionResult<SystemSettings> | null,
  formData: FormData,
): Promise<ActionResult<SystemSettings>> {
  const result = await apiAction<SystemSettings>(
    "put",
    "/admin/settings",
    formDataToObject(formData),
    "Couldn't save settings. Please try again.",
  );
  if (result.status === "success") {
    queryClient.setQueryData(SETTINGS_QUERY_KEY, result.data);
    // The platform name is shown in the shell (and the tab title).
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }
  return result;
}
