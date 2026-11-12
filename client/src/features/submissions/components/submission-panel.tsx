import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { CalendarClock, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { DateTimeText } from "@/components/ui/date-time-text";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentList } from "@/components/files/attachment-list";
import { usePendingAction } from "@/hooks/use-pending-action";
import { UPLOAD_ACCEPT_ATTRIBUTE } from "@/lib/storage/validation";

import {
  removeSubmissionAttachmentAction,
  saveSubmissionDraftAction,
  submitAssignmentAction,
  unsubmitAssignmentAction,
} from "../api";
import { isLateSubmission, toDisplayStatus } from "../lib/display-status";
import type { PrivateCommentSummary, SubmissionView } from "../types";
import { GradeBadge } from "./grade-badge";
import { PrivateCommentPanel } from "./private-comment-panel";
import { SubmissionAttachmentList } from "./submission-attachment-list";
import { SubmissionStatusBadge } from "./submission-status-badge";

const LOCK_MESSAGE: Record<NonNullable<SubmissionView["lockReason"]>, string> = {
  ARCHIVED: "This class is archived - submissions are closed.",
  CLOSED: "Your teacher has closed this assignment - it no longer accepts work.",
  PAST_DUE: "The due date has passed - your teacher isn't accepting late work.",
};

interface SubmissionPanelProps {
  classroomId: string;
  assignmentId: string;
  studentId: string;
  dueDate: Date | null;
  allowLateSubmission: boolean;
  maxPoints: number | null;
  initialView: SubmissionView;
  initialComments: PrivateCommentSummary[];
  archived?: boolean;
}

export function SubmissionPanel({
  classroomId,
  assignmentId,
  studentId,
  dueDate,
  allowLateSubmission,
  maxPoints,
  initialView,
  initialComments,
  archived = false,
}: SubmissionPanelProps) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [textValue, setTextValue] = useState(view.submission?.textAnswer ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [unsubmitConfirmOpen, setUnsubmitConfirmOpen] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [isRemovingAttachment, startRemoveTransition] = useTransition();
  const [isPastDue, setIsPastDue] = useState(
    () => dueDate !== null && Date.now() > dueDate.getTime(),
  );

  // Flips the panel into its locked state the moment the deadline passes, so
  // a student who left the page open can't keep editing a doomed draft.
  // setTimeout can't hold delays past ~24.8 days; a reload covers that case.
  useEffect(() => {
    if (!dueDate || isPastDue) {
      return;
    }
    const delay = dueDate.getTime() - Date.now();
    if (delay > 2_147_483_647) {
      return;
    }
    const timer = setTimeout(() => setIsPastDue(true), Math.max(delay, 0));
    return () => clearTimeout(timer);
  }, [dueDate, isPastDue]);

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set("classroomId", classroomId);
    formData.set("assignmentId", assignmentId);
    formData.set("textAnswer", textValue);
    for (const file of pendingFiles) {
      formData.append("files", file);
    }
    return formData;
  }

  function applyView(next: SubmissionView) {
    setView(next);
    setTextValue(next.submission?.textAnswer ?? "");
    setPendingFiles([]);
    router.refresh();
  }

  const saveDraft = usePendingAction(
    () => saveSubmissionDraftAction(buildFormData()),
    (data) => {
      applyView(data);
      toast.success("Draft saved");
    },
  );

  const submit = usePendingAction(
    () => submitAssignmentAction(buildFormData()),
    (data) => {
      applyView(data);
      setSubmitConfirmOpen(false);
      toast.success("Assignment turned in");
    },
  );

  const unsubmit = usePendingAction(
    () => unsubmitAssignmentAction(classroomId, assignmentId),
    (data) => {
      applyView(data);
      setUnsubmitConfirmOpen(false);
      toast.success("Unsubmitted - you can make changes again");
    },
  );

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles((previous) => [...previous, ...files]);
    }
    event.target.value = "";
  }

  function handleRemovePendingFile(index: number) {
    setPendingFiles((previous) => previous.filter((_, i) => i !== index));
  }

  function handleRemoveAttachment(fileAttachmentId: string) {
    if (!view.submission) {
      return;
    }

    const submissionId = view.submission.id;
    setRemovingAttachmentId(fileAttachmentId);

    startRemoveTransition(async () => {
      const result = await removeSubmissionAttachmentAction(
        classroomId,
        assignmentId,
        submissionId,
        fileAttachmentId,
      );

      if (result.status === "success") {
        setView((previous) =>
          previous.submission
            ? {
                ...previous,
                submission: {
                  ...previous.submission,
                  attachments: previous.submission.attachments.filter(
                    (attachment) => attachment.id !== fileAttachmentId,
                  ),
                },
              }
            : previous,
        );
        toast.success("Attachment removed");
        router.refresh();
      } else {
        toast.error(result.message);
      }

      setRemovingAttachmentId(null);
    });
  }

  const isBusy = saveDraft.isPending || submit.isPending;
  const submission = view.submission;
  // RETURNED: the teacher sent it back for revision. REVIEWED: graded (final).
  const isReturned = submission?.status === "RETURNED";
  const isGraded = submission?.status === "REVIEWED";
  // The server decides the lock (closed, archived, past due with late work
  // off) and enforces it on every mutation; the live timer only flips the
  // past-due lock the moment the deadline passes while the page is open.
  // Work returned for revision can be turned in again after the due date.
  const lockReason =
    view.lockReason ??
    (archived ? "ARCHIVED" : isPastDue && !allowLateSubmission && !isReturned ? "PAST_DUE" : null);
  const effectiveCanEdit = view.canEdit && lockReason === null;
  const effectiveCanUnsubmit = view.canUnsubmit && lockReason === null;
  const displayStatus = toDisplayStatus(submission?.status ?? null, {
    wasLate: isLateSubmission(submission?.submittedAt ?? null, dueDate),
    missing: isPastDue || view.lockReason === "CLOSED",
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Your work</CardTitle>
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
            {isReturned && submission?.returnedAt ? (
              <span>
                Returned for revision <DateTimeText value={submission.returnedAt} />
              </span>
            ) : null}
            {submission?.submittedAt ? (
              <span>
                Turned in <DateTimeText value={submission.submittedAt} />
                {displayStatus === "LATE" ? " (late)" : null}
              </span>
            ) : submission ? (
              <span>
                Last saved <DateTimeText value={submission.updatedAt} />
              </span>
            ) : null}
          </div>

          {isReturned ? (
            <div className="flex flex-col gap-1 rounded-md border border-gold/40 bg-accent px-3 py-2 text-sm">
              <span className="font-semibold text-foreground">
                Your teacher returned this for revision - improve it and turn it in again.
              </span>
              {submission?.feedback ? (
                <span className="whitespace-pre-wrap text-foreground">{submission.feedback}</span>
              ) : null}
            </div>
          ) : null}

          {/* Work already turned in isn't affected by the deadline, so only say so when it matters. */}
          {lockReason &&
          (!submission || submission.status === "ASSIGNED" || lockReason !== "PAST_DUE") ? (
            <p className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Lock className="h-4 w-4 shrink-0" aria-hidden />
              {LOCK_MESSAGE[lockReason]}
            </p>
          ) : null}

          {dueDate && !allowLateSubmission && lockReason === null && view.canEdit ? (
            <p className="text-xs text-muted-foreground">
              Your teacher isn&apos;t accepting late work - turn this in before the due date.
            </p>
          ) : null}

          {dueDate && allowLateSubmission && isPastDue && lockReason === null && view.canEdit ? (
            <p className="text-xs text-muted-foreground">
              The due date has passed - work turned in now is marked Late.
            </p>
          ) : null}

          {effectiveCanEdit ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="submission-text">Your response</Label>
                <Textarea
                  id="submission-text"
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  rows={6}
                  maxLength={20_000}
                  placeholder="Type your response..."
                  disabled={isBusy}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="submission-files">Attachments</Label>
                <SubmissionAttachmentList
                  attachments={view.submission?.attachments ?? []}
                  pendingFiles={pendingFiles}
                  editable
                  removingAttachmentId={isRemovingAttachment ? removingAttachmentId : null}
                  onRemoveAttachment={handleRemoveAttachment}
                  onRemovePendingFile={handleRemovePendingFile}
                />
                <input
                  id="submission-files"
                  type="file"
                  multiple
                  accept={UPLOAD_ACCEPT_ATTRIBUTE}
                  onChange={handleFilesSelected}
                  disabled={isBusy}
                  className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  PDF, Word, PowerPoint, Excel, text, ZIP, images, and videos - up to 25MB each.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={saveDraft.run} disabled={isBusy}>
                  {saveDraft.isPending ? "Saving…" : "Save draft"}
                </Button>
                <Button type="button" onClick={() => setSubmitConfirmOpen(true)} disabled={isBusy}>
                  Turn in
                </Button>
              </div>
            </>
          ) : (
            <>
              {view.submission?.textAnswer ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {view.submission.textAnswer}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No text response.</p>
              )}

              {view.submission ? (
                <AttachmentList attachments={view.submission.attachments} />
              ) : null}

              {effectiveCanUnsubmit ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUnsubmitConfirmOpen(true)}
                  disabled={unsubmit.isPending}
                >
                  {unsubmit.isPending ? "Unsubmitting…" : "Unsubmit"}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>

        <ConfirmDialog
          open={submitConfirmOpen}
          onOpenChange={setSubmitConfirmOpen}
          title="Turn in this assignment?"
          description={
            isReturned
              ? "Your teacher will review your revised work and grade it."
              : allowLateSubmission
                ? "Your teacher will be able to see your response and attachments. Until it's graded you can unsubmit to make changes - work turned in again after the due date is marked Late."
                : "Your teacher will be able to see your response and attachments. Until it's graded you can unsubmit to make changes before the due date."
          }
          confirmLabel="Turn in"
          pending={submit.isPending}
          onConfirm={submit.run}
        />

        <ConfirmDialog
          open={unsubmitConfirmOpen}
          onOpenChange={setUnsubmitConfirmOpen}
          title="Unsubmit this assignment?"
          description="Your work will go back to draft so you can make changes. Remember to turn it in again before the due date."
          confirmLabel="Unsubmit"
          pending={unsubmit.isPending}
          onConfirm={unsubmit.run}
        />
      </Card>

      {isGraded && maxPoints !== null ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Grade</CardTitle>
            <GradeBadge grade={view.submission?.grade ?? null} maxPoints={maxPoints} />
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {view.submission?.feedback || "No feedback given."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PrivateCommentPanel
        classroomId={classroomId}
        assignmentId={assignmentId}
        studentId={studentId}
        initialComments={initialComments}
        canComment={view.submission !== null}
        visibilityNote="Only visible to you and your teacher."
        disabledNote="Save a draft first to start a private conversation with your teacher."
      />
    </div>
  );
}
