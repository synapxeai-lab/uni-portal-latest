import type { SubmissionStatus } from "@portal/shared/enums";

/**
 * A 7-bucket presentational status shared by the student panel, the teacher's
 * submission list, the review page, and To-do - collapses "no row yet" and
 * the raw SubmissionStatus enum into one consistent vocabulary so every
 * surface labels things identically.
 */
export type SubmissionDisplayStatus =
  "NOT_SUBMITTED" | "MISSING" | "DRAFT" | "SUBMITTED" | "LATE" | "GRADED" | "RETURNED";

/** True when work was turned in after the due date - the single definition of "late". */
export function isLateSubmission(submittedAt: Date | null, dueDate: Date | null): boolean {
  return submittedAt !== null && dueDate !== null && submittedAt > dueDate;
}

/**
 * `wasLate` (see isLateSubmission) decides Submitted vs. Late for turned-in,
 * ungraded work, so a due date moved after the fact never changes the label
 * on its own. REVIEWED is graded work (final, and visible to the student);
 * RETURNED is work the teacher sent back for the student to revise. `missing` marks work that isn't turned in
 * and no longer can be on time (past due, or the assignment was closed).
 */
export function toDisplayStatus(
  status: SubmissionStatus | null,
  options?: { wasLate?: boolean; missing?: boolean },
): SubmissionDisplayStatus {
  switch (status) {
    case "SUBMITTED":
    case "LATE":
      return (options?.wasLate ?? status === "LATE") ? "LATE" : "SUBMITTED";
    case "REVIEWED":
      return "GRADED";
    case "RETURNED":
      return "RETURNED";
    case "ASSIGNED":
      return options?.missing ? "MISSING" : "DRAFT";
    case "MISSING":
    case null:
    case undefined:
    default:
      return options?.missing ? "MISSING" : "NOT_SUBMITTED";
  }
}

export const SUBMISSION_DISPLAY_STATUS_LABEL: Record<SubmissionDisplayStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  MISSING: "Missing",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  LATE: "Late",
  GRADED: "Graded",
  RETURNED: "Returned for revision",
};

export const SUBMISSION_DISPLAY_STATUS_BADGE_VARIANT: Record<
  SubmissionDisplayStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  NOT_SUBMITTED: "outline",
  MISSING: "destructive",
  DRAFT: "outline",
  SUBMITTED: "success",
  LATE: "destructive",
  GRADED: "success",
  RETURNED: "secondary",
};
