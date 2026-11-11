import { useQuery } from "@tanstack/react-query";

import type { SessionResponse } from "@portal/shared/auth";

import { api, apiGet } from "./api";
import { queryClient } from "./query-client";

export const SESSION_QUERY_KEY = ["session"] as const;

export function fetchSession(): Promise<SessionResponse> {
  return apiGet<SessionResponse>("/auth/session");
}

/** The signed-in session (user, platform name, unread badge seed). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Signs out: revokes the server-side session row, then does a full page load
 * of /login so no cached data of the previous user survives in memory.
 */
export async function signOut(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    queryClient.clear();
    window.location.assign("/login");
  }
}
