import { AxiosError } from "axios";

import { api } from "./api";
import { queryClient } from "./query-client";

/**
 * Session loss mid-use (signed out elsewhere, session terminated by an admin,
 * account suspended): any 401 from a protected endpoint sends the user to
 * /login with a clean cache. A pending forced password change (403
 * PASSWORD_CHANGE_REQUIRED) sends them to /change-password - the client-side
 * counterpart of the old proxy.ts redirects.
 */
export function installAuthInterceptor(): void {
  api.interceptors.response.use(undefined, (error: unknown) => {
    if (error instanceof AxiosError && error.response) {
      const url = error.config?.url ?? "";
      const { pathname } = window.location;
      const code = (error.response.data as { code?: string } | undefined)?.code;

      if (error.response.status === 401 && !url.startsWith("/auth/") && pathname !== "/login") {
        queryClient.clear();
        window.location.assign("/login");
      } else if (code === "PASSWORD_CHANGE_REQUIRED" && pathname !== "/change-password") {
        window.location.assign("/change-password");
      }
    }
    return Promise.reject(error);
  });
}
