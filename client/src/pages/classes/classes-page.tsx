import { UsersRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/states/skeletons";
import { UserRole } from "@portal/shared/enums";
import { useClassrooms } from "@/features/classroom/api";
import { ClassesPageActions } from "@/features/classroom/components/classes-page-actions";
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
  const canCreate = role === UserRole.TEACHER || role === UserRole.ADMIN;

  return (
    <QueryView query={classrooms} loading={<ClassesLoading />}>
      {(list) => (
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {list.map((classroom) => (
                <ClassroomCard key={classroom.id} classroom={classroom} />
              ))}
            </div>
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
