import { useLocation } from "react-router";
import { School } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { Pagination } from "@/components/page/pagination";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { useAdminClassroomsPage } from "@/features/admin/classrooms/api";
import { ClassroomsTable } from "@/features/admin/classrooms/components/classrooms-table";
import { ClassroomsToolbar } from "@/features/admin/classrooms/components/classrooms-toolbar";
import type { ClassroomSortField, SortDirection } from "@/features/admin/classrooms/types";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

const sortFields: ClassroomSortField[] = ["title", "status", "createdAt", "memberCount"];

export default function AdminClassroomsPage() {
  const { search } = useLocation();
  const [sortFieldRaw, sortDirRaw] = (useSearchParams().get("sort") ?? "").split(":");
  const sortField = sortFields.includes(sortFieldRaw as ClassroomSortField)
    ? (sortFieldRaw as ClassroomSortField)
    : undefined;
  const sortDir: SortDirection = sortDirRaw === "asc" ? "asc" : "desc";
  const classroomsPage = useAdminClassroomsPage(search);

  return (
    <QueryView query={classroomsPage} loading={<AdminLoading />}>
      {(page) => (
        <PageContainer>
          <SectionHeader
            title="Classrooms"
            description="View, archive, restore, and reassign classrooms across the platform."
            breadcrumbs={[{ label: "Classrooms" }]}
          />
          <ClassroomsToolbar />
          {page.classrooms.length === 0 ? (
            <EmptyState
              icon={School}
              title="No classrooms found"
              description="Try a different search or filter."
            />
          ) : (
            <>
              <ClassroomsTable
                classrooms={page.classrooms}
                sortField={sortField}
                sortDir={sortDir}
              />
              <Pagination
                page={page.page}
                totalPages={page.totalPages}
                total={page.total}
                pageSize={page.pageSize}
                itemLabel="classrooms"
              />
            </>
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
