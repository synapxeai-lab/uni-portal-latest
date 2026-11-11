import type { ReactNode } from "react";
import { Award, CalendarClock, ClipboardX } from "lucide-react";

import { AttachmentList } from "@/components/files/attachment-list";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignmentDetail } from "@/features/classwork/api";
import { AssignmentManagementMenu } from "@/features/classwork/components/assignment-management-menu";
import type { AssignmentSummary } from "@/features/classwork/types";
import { useSubmissionPanel } from "@/features/submissions/api";
import { GradeSummaryCard } from "@/features/submissions/components/grade-summary-card";
import { SubmissionOverviewCard } from "@/features/submissions/components/submission-overview-card";
import { SubmissionPanel } from "@/features/submissions/components/submission-panel";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";
import { useParams } from "@/lib/navigation";

import { useCurrentClassroom } from "./classroom-layout";

export function AssignmentDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export function AssignmentNotFound() {
  return (
    <EmptyState
      icon={ClipboardX}
      title="Assignment not found"
      description="This assignment doesn't exist, or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/classes">Back to classes</Link>
        </Button>
      }
    />
  );
}

/**
 * Right-hand column: the teacher's submission overview and grade summary, or
 * the student's own submission panel - loaded in one request.
 */
function SubmissionColumn({
  classroomId,
  assignment,
  archived,
}: {
  classroomId: string;
  assignment: AssignmentSummary;
  archived: boolean;
}): ReactNode {
  const panel = useSubmissionPanel(classroomId, assignment.id);
  const studentId = useSession().data?.user.id ?? "";

  return (
    <QueryView query={panel} loading={<Skeleton className="h-32" />} notFound={null}>
      {(data) =>
        data.kind === "teacher" ? (
          <>
            <SubmissionOverviewCard
              classroomId={classroomId}
              assignmentId={assignment.id}
              overview={data.overview}
            />
            <GradeSummaryCard summary={data.gradeSummary} maxPoints={assignment.points} />
          </>
        ) : (
          <SubmissionPanel
            classroomId={classroomId}
            assignmentId={assignment.id}
            studentId={studentId}
            dueDate={assignment.dueDate}
            allowLateSubmission={assignment.allowLateSubmission}
            maxPoints={assignment.points}
            initialView={data.view}
            initialComments={data.comments}
            archived={archived}
          />
        )
      }
    </QueryView>
  );
}

export default function AssignmentDetailPage() {
  const classroom = useCurrentClassroom();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const detail = useAssignmentDetail(classroom.id, assignmentId);
  const classroomId = classroom.id;
  const archived = classroom.status === "ARCHIVED";

  return (
    <QueryView
      query={detail}
      loading={<AssignmentDetailLoading />}
      notFound={<AssignmentNotFound />}
    >
      {({ assignment, topics }) => {
        // Archived classrooms are read-only - the management menu is hidden
        // here too. The server independently enforces this for every mutation.
        const canManageContent = assignment.canManage && !archived;

        return (
          <div className="flex flex-col gap-4">
            <SectionHeader
              title={assignment.title}
              breadcrumbs={[
                { label: "Classwork", href: `/classes/${classroomId}/classwork` },
                { label: assignment.title },
              ]}
              actions={
                canManageContent ? (
                  <AssignmentManagementMenu
                    classroomId={classroomId}
                    assignment={assignment}
                    topics={topics}
                  />
                ) : null
              }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-2">
                <Card>
                  <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0">
                    {assignment.status !== "PUBLISHED" ? (
                      <Badge variant={assignment.status === "CLOSED" ? "secondary" : "outline"}>
                        {assignment.status === "CLOSED" ? "Closed" : "Draft"}
                      </Badge>
                    ) : null}
                    {assignment.dueDate ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4" aria-hidden />
                        <DateTimeText value={assignment.dueDate} variant="due" />
                      </span>
                    ) : null}
                    {assignment.dueDate && !assignment.allowLateSubmission ? (
                      <Badge variant="outline">No late work</Badge>
                    ) : null}
                    {assignment.points !== null ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Award className="h-4 w-4" aria-hidden />
                        {assignment.points} points
                      </span>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      Posted by {assignment.authorName}
                    </span>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {assignment.description ? (
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {assignment.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No instructions provided.</p>
                    )}

                    {assignment.attachments.length > 0 ? (
                      <div className="flex flex-col gap-2 border-t border-border pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Attachments
                        </p>
                        <AttachmentList attachments={assignment.attachments} />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                <SubmissionColumn
                  classroomId={classroomId}
                  assignment={assignment}
                  archived={archived}
                />
              </div>
            </div>
          </div>
        );
      }}
    </QueryView>
  );
}
