import { Suspense } from "react";
import { Outlet, useOutletContext } from "react-router";
import { FolderX } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassroom } from "@/features/classroom/api";
import { ClassroomHeader } from "@/features/classroom/components/classroom-header";
import { ClassroomTabs } from "@/features/classroom/components/classroom-tabs";
import type { ClassroomSummary } from "@/features/classroom/types";
import { QueryView } from "@/app/route-states";
import { useParams } from "@/lib/navigation";

export function ClassroomLoading() {
  return (
    <div className="flex flex-col">
      <Skeleton className="h-40 w-full rounded-none sm:h-48" />
      <PageContainer className="gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    </div>
  );
}

/** Loading state for a tab's body - the header and tabs above it stay put. */
export function ClassroomTabLoading() {
  return <Skeleton className="h-40 w-full" />;
}

export function ClassroomNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={FolderX}
        title="Class not found"
        description="This class doesn't exist, or you don't have access to it."
        action={
          <Button asChild>
            <Link href="/classes">Back to classes</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}

/** The classroom a nested tab is rendered in (loaded once by the layout). */
export function useCurrentClassroom(): ClassroomSummary {
  return useOutletContext<ClassroomSummary>();
}

/** /classes/:classroomId/* - header banner and tabs shared by every tab. */
export default function ClassroomLayout() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const classroom = useClassroom(classroomId);

  return (
    <QueryView query={classroom} loading={<ClassroomLoading />} notFound={<ClassroomNotFound />}>
      {(data) => (
        <div className="flex flex-col">
          <ClassroomHeader classroom={data} />
          <PageContainer className="gap-4">
            <ClassroomTabs classroomId={data.id} isOffering={data.offering !== null} />
            <Suspense fallback={<ClassroomTabLoading />}>
              <Outlet context={data} />
            </Suspense>
          </PageContainer>
        </div>
      )}
    </QueryView>
  );
}
