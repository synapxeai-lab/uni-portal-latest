import { useLocation } from "react-router";
import { Users as UsersIcon } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { Pagination } from "@/components/page/pagination";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { useUsersPage } from "@/features/admin/users/api";
import { CreateUserButton } from "@/features/admin/users/components/create-user-button";
import { UsersTable } from "@/features/admin/users/components/users-table";
import { UsersToolbar } from "@/features/admin/users/components/users-toolbar";
import type { SortDirection, UserSortField } from "@/features/admin/users/types";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";
import { useSearchParams } from "@/lib/navigation";

const sortFields: UserSortField[] = ["name", "email", "role", "status", "createdAt"];

export default function AdminUsersPage() {
  const { search } = useLocation();
  const [sortFieldRaw, sortDirRaw] = (useSearchParams().get("sort") ?? "").split(":");
  const sortField = sortFields.includes(sortFieldRaw as UserSortField)
    ? (sortFieldRaw as UserSortField)
    : undefined;
  const sortDir: SortDirection = sortDirRaw === "asc" ? "asc" : "desc";
  const currentUserId = useSession().data?.user.id ?? "";
  const usersPage = useUsersPage(search);

  return (
    <QueryView query={usersPage} loading={<AdminLoading />}>
      {(page) => (
        <PageContainer>
          <SectionHeader
            title="Users"
            description="Create and manage administrator, teacher, and student accounts."
            breadcrumbs={[{ label: "Users" }]}
            actions={<CreateUserButton />}
          />
          <UsersToolbar />
          {page.users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No users found"
              description="Try a different search or filter, or create a new user."
            />
          ) : (
            <>
              <UsersTable
                users={page.users}
                currentUserId={currentUserId}
                sortField={sortField}
                sortDir={sortDir}
              />
              <Pagination
                page={page.page}
                totalPages={page.totalPages}
                total={page.total}
                pageSize={page.pageSize}
                itemLabel="users"
              />
            </>
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
