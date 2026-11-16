import { SearchX, UsersRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/states/skeletons";
import { UserRole } from "@portal/shared/enums";
import { useClassrooms } from "@/features/classroom/api";
import { ClassesPageActions } from "@/features/classroom/components/classes-page-actions";
import { ClassesFilters, filterClasses, groupByDiploma, useClassFilters } from "@/features/classroom/components/classes-filters";
import { ClassroomCard } from "@/features/classroom/components/classroom-card";
import type { ClassroomSummary } from "@/features/classroom/types";
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

function ClassGrid({ classes }: { classes: ClassroomSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {classes.map((classroom) => (
        <ClassroomCard key={classroom.id} classroom={classroom} />
      ))}
    </div>
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
                ) : canCreate ? (
                  // Grouped by diploma so a long list reads diploma by diploma.
                  <div className="flex flex-col gap-8">
                    {groupByDiploma(shown).map((group) => (
                      <section key={group.key} aria-labelledby={`diploma-${group.key}`} className="flex flex-col gap-3">
                        <h2 id={`diploma-${group.key}`} className="flex items-baseline gap-2 border-b pb-2 text-base font-semibold">
                          <span className="min-w-0 truncate">{group.title}</span>
                          <span className="shrink-0 text-sm font-normal text-muted-foreground">
                            {group.classes.length} class{group.classes.length === 1 ? "" : "es"}
                          </span>
                        </h2>
                        <ClassGrid classes={group.classes} />
                      </section>
                    ))}
                  </div>
                ) : (
                  <ClassGrid classes={shown} />
                )}
              </>
            )}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
