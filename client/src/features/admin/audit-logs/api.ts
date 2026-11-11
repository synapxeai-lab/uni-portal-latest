import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";

import type { AuditLogsPage } from "./types";

/** Audit log page for the current URL filters (kept on screen while the next page loads). */
export function useAuditLogsPage(search: string) {
  return useQuery({
    queryKey: ["admin", "audit-logs", search],
    queryFn: () => apiGet<AuditLogsPage>(`/admin/audit-logs${search}`),
    placeholderData: keepPreviousData,
  });
}
