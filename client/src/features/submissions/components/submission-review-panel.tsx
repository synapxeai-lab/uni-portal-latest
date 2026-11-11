import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePendingAction } from "@/hooks/use-pending-action";
import { formatDuration } from "@/lib/datetime/format";
import { getInitials } from "@/lib/utils";

import { gradeSubmissionAction, returnGradedSubmissionAction, updateGradeAction } from "../api";
import { isLateSubmission, toDisplayStatus } from "../lib/display-status";
import { formatGrade } from "../lib/format-grade";
import type { SubmissionReviewDetail } from "../types";
import { GradeBadge } from "./grade-badge";
import { PrivateCommentPanel } from "./private-comment-panel";
import { SubmissionAttachmentList } from "./submission-attachment-list";
import { SubmissionStatusBadge } from "./submission-status-badge";

interface SubmissionReviewPanelProps {
  classroomId: string;
  assignmentId: string;
  studentId: string;
  dueDate: Date | null;
  maxPoints: number | null;
  initialDetail: SubmissionReviewDetail;
}

export function SubmissionReviewPanel({
  classroomId,
  assignmentId,
  studentId,
  dueDate,
  maxPoints,
  initialDetail,
}: SubmissionReviewPanelProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [gradeValue, setGradeValue] = useState(detail.submission?.grade?.toString() ?? "");
  const [feedbackValue, setFeedbackValue] = useState(detail.submission?.feedback ?? "");
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);

  function applyDetail(next: SubmissionReviewDetail) {
    setDetail(next);
    setGradeValue(next.submission?.grade?.toString() ?? "");
    setFeedbackValue(next.submission?.feedback ?? "");
    router.refresh();
  }

  const hasExistingGrade =
    detail.submission?.grade !== null && detail.submission?.grade !== undefined;

  const saveGrade = usePendingAction(
    () => {
      const grade = Number(gradeValue);
      const action = hasExistingGrade ? updateGradeAction : gradeSubmissionAction;
      return action(classroomId, assignmentId, studentId, grade, feedbackValue || undefined);
    },
    (data) => {
      applyDetail(data);
      toast.success("Grade saved");
    },
  );

  const returnSubmission = usePendingAction(
    () => returnGradedSubmissionAction(classroomId, assignmentId, studentId),
    (data) => {
      applyDetail(data);
      setReturnConfirmOpen(false);
      toast.success("Submission returned");
    },
  );

  const [renderedAt] = useState(() => Date.now());
  const submission = detail.submission;
  const submittedAt = submission?.submittedAt ?? null;
  const wasLate = isLateSubmission(submittedAt, dueDate);
  const displayStatus = toDisplayStatus(submission?.status ?? null, {
    wasLate,
    missing: dueDate !== null && dueDate.getTime() < renderedAt,
  });

  const gradeValueNumber = Number(gradeValue);
  const isGradeValid =
    gradeValue.trim() !== "" &&
    Number.isInteger(gradeValueNumber) &&
    gradeValueNumber >= 0 &&
    (maxPoints === null || gradeValueNumber <= maxPoints);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9">
              {detail.student.image ? (
                <AvatarImage src={detail.student.image} alt={detail.student.name} />
              ) : null}
              <AvatarFallback>{getInitials(detail.student.name)}</AvatarFallback>
            </Avatar>
            <CardTitle>{detail.student.name}</CardTitle>
          </div>
          <SubmissionStatusBadge status={displayStatus} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {dueDate ? (
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                <DateTimeText value={dueDate} variant="due" />
              </span>
            ) : null}
            {submittedAt ? (
              <span className={wasLate ? "font-medium text-destructive" : undefined}>
                Turned in <DateTimeText value={submittedAt} />
                {wasLate && dueDate
                  ? ` - ${formatDuration(submittedAt.getTime() - dueDate.getTime())} late`
                  : " - on time"}
              </span>
            ) : null}
            {submission?.returnedAt ? (
              <span>
                Returned <DateTimeText value={submission.returnedAt} />
              </span>
            ) : null}
          </div>

          {detail.submission ? (
            <>
              {detail.submission.textAnswer ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {detail.submission.textAnswer}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No text response.</p>
              )}

              <SubmissionAttachmentList
                attachments={detail.submission.attachments}
                pendingFiles={[]}
                editable={false}
              />

              {detail.canReturn ? (
                <Button
                  type="button"
                  className="w-fit"
                  onClick={() => setReturnConfirmOpen(true)}
                  disabled={returnSubmission.isPending}
                >
                  {returnSubmission.isPending ? "Returning…" : "Return"}
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This student hasn&apos;t started their submission yet.
            </p>
          )}
        </CardContent>

        <ConfirmDialog
          open={returnConfirmOpen}
          onOpenChange={setReturnConfirmOpen}
          title="Return this submission?"
          description={
            detail.submission?.grade !== null && detail.submission?.grade !== undefined
              ? `${detail.student.name} will see their grade (${formatGrade(detail.submission.grade, maxPoints)}) and feedback. The grade will be locked.`
              : `${detail.student.name} will see their work marked as returned. No grade has been entered.`
          }
          confirmLabel="Return"
          pending={returnSubmission.isPending}
          onConfirm={returnSubmission.run}
        />
      </Card>

      {detail.submission && maxPoints !== null ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Grade</CardTitle>
            <GradeBadge grade={detail.submission.grade} maxPoints={maxPoints} />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {detail.canGrade ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="grade-input">Points</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="grade-input"
                      type="number"
                      min={0}
                      max={maxPoints}
                      step={1}
                      value={gradeValue}
                      onChange={(event) => setGradeValue(event.target.value)}
                      disabled={saveGrade.isPending}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">/ {maxPoints}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="feedback-input">Feedback</Label>
                  <Textarea
                    id="feedback-input"
                    value={feedbackValue}
                    onChange={(event) => setFeedbackValue(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="Overall feedback for this submission..."
                    disabled={saveGrade.isPending}
                  />
                </div>

                <Button
                  type="button"
                  className="w-fit"
                  onClick={saveGrade.run}
                  disabled={!isGradeValid || saveGrade.isPending}
                >
                  {saveGrade.isPending
                    ? "Saving…"
                    : hasExistingGrade
                      ? "Update grade"
                      : "Save grade"}
                </Button>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {detail.submission.feedback || "No feedback given."}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <PrivateCommentPanel
        classroomId={classroomId}
        assignmentId={assignmentId}
        studentId={studentId}
        initialComments={detail.comments}
        canComment={detail.submission !== null}
        visibilityNote={`Only visible to you and ${detail.student.name}.`}
        disabledNote="This student hasn't started their submission yet, so there's nothing to comment on."
      />
    </div>
  );
}
