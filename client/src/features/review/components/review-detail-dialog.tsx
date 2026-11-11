import { useEffect, useState } from "react";
import Link from "@/components/ui/link";
import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { SubmissionReviewPanel } from "@/features/submissions/components/submission-review-panel";
import type { SubmissionReviewDetail } from "@/features/submissions/types";

import { getReviewSubmissionDetailAction } from "../api";
import type { ReviewQueueRow } from "../types";

interface ReviewDetailDialogProps {
  row: ReviewQueueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Grade / Return / Leave a private comment, without leaving the queue -
 * embeds the exact same SubmissionReviewPanel the full submission detail
 * page uses, fed by the same service call, so there is no second
 * implementation of the grading/return/comment logic to keep in sync.
 */
export function ReviewDetailDialog({ row, open, onOpenChange }: ReviewDetailDialogProps) {
  const [detail, setDetail] = useState<SubmissionReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    // Kicking off a network fetch when the dialog opens, not deriving state
    // from props/state that render could compute directly.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    getReviewSubmissionDetailAction(row.classroomId, row.assignmentId, row.studentId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError(true);
        } else {
          setDetail(result);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, row.classroomId, row.assignmentId, row.studentId]);

  const fullPageHref = `/classes/${row.classroomId}/classwork/${row.assignmentId}/submissions/${row.studentId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.studentName}</DialogTitle>
          <DialogDescription>
            {row.assignmentTitle} · {row.classroomTitle}
          </DialogDescription>
        </DialogHeader>

        <Link href={fullPageHref} className="link-pill -ml-3 w-fit text-xs text-primary">
          Open full page <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>

        {loading ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error || !detail ? (
          <EmptyState
            title="Couldn't load this submission"
            description="It may have changed since the queue last refreshed. Try reopening it."
          />
        ) : (
          <SubmissionReviewPanel
            classroomId={row.classroomId}
            assignmentId={row.assignmentId}
            studentId={row.studentId}
            dueDate={row.dueDate}
            maxPoints={row.maxPoints}
            initialDetail={detail}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
