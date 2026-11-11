import { UserX } from "lucide-react";

import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubmissionReview } from "@/features/submissions/api";
import { SubmissionReviewPanel } from "@/features/submissions/components/submission-review-panel";
import { QueryView } from "@/app/route-states";
import { useParams } from "@/lib/navigation";

import { useCurrentClassroom } from "./classroom-layout";

function SubmissionReviewLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function SubmissionReviewNotFound() {
  return (
    <EmptyState
      icon={UserX}
      title="Submission not found"
      description="This student isn't enrolled in this class, or you don't have access to their submission."
      action={
        <Button asChild>
          <Link href="/classes">Back to classes</Link>
        </Button>
      }
    />
  );
}

/** Teacher-only: review, grade and return one student's submission. */
export default function SubmissionReviewPage() {
  const classroomId = useCurrentClassroom().id;
  const { assignmentId, studentId } = useParams<{ assignmentId: string; studentId: string }>();
  const review = useSubmissionReview(classroomId, assignmentId, studentId);

  return (
    <QueryView
      query={review}
      loading={<SubmissionReviewLoading />}
      notFound={<SubmissionReviewNotFound />}
    >
      {({ assignment, detail }) => (
        <div className="flex flex-col gap-4">
          <SectionHeader
            title={detail.student.name}
            breadcrumbs={[
              { label: "Classwork", href: `/classes/${classroomId}/classwork` },
              {
                label: assignment.title,
                href: `/classes/${classroomId}/classwork/${assignmentId}`,
              },
              {
                label: "Submissions",
                href: `/classes/${classroomId}/classwork/${assignmentId}/submissions`,
              },
              { label: detail.student.name },
            ]}
          />
          <SubmissionReviewPanel
            // Remount when switching students so local grading state resets.
            key={studentId}
            classroomId={classroomId}
            assignmentId={assignmentId}
            studentId={studentId}
            dueDate={assignment.dueDate}
            maxPoints={assignment.points}
            initialDetail={detail}
          />
        </div>
      )}
    </QueryView>
  );
}
