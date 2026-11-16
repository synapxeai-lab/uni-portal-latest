import { SearchX, UsersRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/states/skeletons";
import { UserRole } from "@portal/shared/enums";
import { useClassrooms } from "@/features/classroom/api";
import { ClassesPageActions } from "@/features/classroom/components/classes-page-actions";
import { ClassesFilters, filterClasses, useClassFilters } from "@/features/classroom/components/classes-filters";
import { ClassroomCard } from "@/features/classroom/components/classroom-card";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

export function ClassesLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </PageContainer>
  );
}

export default function ClassesPage() {
  const classrooms = useClassrooms();
  const role = useSession().data?.user.role;
  // Teachers and admins create classes, and they're the ones with many to look through.
  const canCreate = role === UserRole.TEACHER || role === UserRole.ADMIN;
  const isAdmin = role === UserRole.ADMIN;
  const classFilters = useClassFilters();
  const { set, clear } = classFilters;
  // Only admins filter by teacher; a teacher's list is already just their own classes.
  const filters = isAdmin ? classFilters.filters : { ...classFilters.filters, teacher: "" };

  return (
    <QueryView query={classrooms} loading={<ClassesLoading />}>
      {(list) => {
        const shown = canCreate ? filterClasses(list, filters) : list;
        return (
          <PageContainer>
            <SectionHeader
              title="Classes"
              description="Classes you teach or are enrolled in."
              actions={<ClassesPageActions canCreate={canCreate} />}
            />
            {list.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="No classes yet"
                description="Create a class or join one with a class code to get started."
              />
            ) : (
              <>
                {canCreate ? (
                  <ClassesFilters list={list} filters={filters} onChange={set} onClear={clear} shown={shown.length} showTeacher={isAdmin} />
                ) : null}
                {shown.length === 0 ? (
                  <EmptyState icon={SearchX} title="No classes match these filters" description="Change or clear the filters to see more." />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {shown.map((classroom) => (
                      <ClassroomCard key={classroom.id} classroom={classroom} />
                    ))}
                  </div>
                )}
              </>
            )}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
