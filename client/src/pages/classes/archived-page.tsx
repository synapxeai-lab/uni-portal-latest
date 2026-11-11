import { Archive } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { useArchivedClassrooms } from "@/features/classroom/api";
import { ClassroomCard } from "@/features/classroom/components/classroom-card";
import { QueryView } from "@/app/route-states";

import { ClassesLoading } from "./classes-page";

export default function ArchivedClassesPage() {
  const classrooms = useArchivedClassrooms();

  return (
    <QueryView query={classrooms} loading={<ClassesLoading />}>
      {(list) => (
        <PageContainer>
          <SectionHeader
            title="Archived classes"
            description="Read-only classes you can still view, but not post, submit, or invite to. Restore one from its ⋮ menu to make it active again."
          />
          {list.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="No archived classes"
              description="Classes you archive (or that are archived by an admin) will show up here."
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
