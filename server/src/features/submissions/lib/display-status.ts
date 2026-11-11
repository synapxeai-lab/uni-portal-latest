import type { SubmissionStatus } from "@/generated/prisma/enums";

/**
 * A 6-bucket presentational status shared by the student panel, the teacher's
 * submission list, the review page, and To-do - collapses "no row yet" and
 * the raw SubmissionStatus enum into one consistent vocabulary so every
 * surface labels things identically.
 */
export type SubmissionDisplayStatus =
  "NOT_SUBMITTED" | "MISSING" | "DRAFT" | "SUBMITTED" | "LATE" | "RETURNED";

/** True when work was turned in after the due date - the single definition of "late". */
export function isLateSubmission(submittedAt: Date | null, dueDate: Date | null): boolean {
  return submittedAt !== null && dueDate !== null && submittedAt > dueDate;
}

/**
 * `wasLate` (see isLateSubmission) decides Submitted vs. Late for every
 * turned-in state, so a due date moved after the fact, or grading in progress
 * (REVIEWED, which must read exactly like its pre-grading state), never
 * changes the label on its own. `missing` marks work that isn't turned in
 * and no longer can be on time (past due, or the assignment was closed).
 */
export function toDisplayStatus(
  status: SubmissionStatus | null,
  options?: { wasLate?: boolean; missing?: boolean },
): SubmissionDisplayStatus {
  switch (status) {
    case "SUBMITTED":
    case "LATE":
    case "REVIEWED":
      return (options?.wasLate ?? status === "LATE") ? "LATE" : "SUBMITTED";
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
  RETURNED: "Returned",
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
  RETURNED: "secondary",
};
