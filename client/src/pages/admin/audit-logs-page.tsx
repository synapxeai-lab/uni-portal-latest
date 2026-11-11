import { useLocation } from "react-router";
import { ScrollText } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { Pagination } from "@/components/page/pagination";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { useAuditLogsPage } from "@/features/admin/audit-logs/api";
import { AuditLogsTable } from "@/features/admin/audit-logs/components/audit-logs-table";
import { ADMIN_AUDIT_EVENT_LABELS } from "@/features/admin/audit-logs/lib/audit-events";
import { ReportFilterBar } from "@/features/admin/reports/components/report-filter-bar";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";

export default function AdminAuditLogsPage() {
  const { search } = useLocation();
  const auditLogs = useAuditLogsPage(search);

  return (
    <QueryView query={auditLogs} loading={<AdminLoading />}>
      {({ entries, total, page, pageSize, totalPages }) => (
        <PageContainer>
          <SectionHeader
            title="Audit logs"
            description="A record of administrative actions taken across the platform."
            breadcrumbs={[{ label: "Audit logs" }]}
          />
          <ReportFilterBar
            searchPlaceholder="Search by actor or target"
            selectFilters={[
              {
                param: "event",
                label: "All events",
                options: ADMIN_AUDIT_EVENT_LABELS.map((label) => ({ value: label, label })),
              },
            ]}
          />
          {entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit events found"
              description="Try a different search or filter."
            />
          ) : (
            <>
              <AuditLogsTable entries={entries} />
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                itemLabel="events"
              />
            </>
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
