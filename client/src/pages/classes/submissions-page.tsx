import { SectionHeader } from "@/components/page/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubmissionList } from "@/features/submissions/api";
import { SubmissionList } from "@/features/submissions/components/submission-list";
import { QueryView } from "@/app/route-states";
import { useParams } from "@/lib/navigation";

import { AssignmentNotFound } from "./assignment-page";
import { useCurrentClassroom } from "./classroom-layout";

function SubmissionsListLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Teacher-only: every student's submission for one assignment. */
export default function SubmissionsListPage() {
  const classroomId = useCurrentClassroom().id;
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const list = useSubmissionList(classroomId, assignmentId);

  return (
    <QueryView query={list} loading={<SubmissionsListLoading />} notFound={<AssignmentNotFound />}>
      {({ assignment, overview }) => (
        <div className="flex flex-col gap-4">
          <SectionHeader
            title="Submissions"
            breadcrumbs={[
              { label: "Classwork", href: `/classes/${classroomId}/classwork` },
              {
                label: assignment.title,
                href: `/classes/${classroomId}/classwork/${assignmentId}`,
              },
              { label: "Submissions" },
            ]}
          />
          <SubmissionList
            classroomId={classroomId}
            assignmentId={assignmentId}
            maxPoints={assignment.points}
            overview={overview}
          />
        </div>
      )}
    </QueryView>
  );
}
