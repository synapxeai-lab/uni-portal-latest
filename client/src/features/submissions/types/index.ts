import type { SubmissionStatus } from "@portal/shared/enums";
import type { AttachedFileSummary } from "@/lib/file-attachments";

import type { SubmissionDisplayStatus } from "../lib/display-status";

export type { ActionResult } from "@/types/action-result";
export type { SubmissionStatus } from "@portal/shared/enums";
export type { SubmissionDisplayStatus } from "../lib/display-status";

export interface SubmissionDetail {
  id: string;
  textAnswer: string | null;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  returnedAt: Date | null;
  /** Null when ungraded, or (student view only) when graded but not yet returned. */
  grade: number | null;
  /** Same visibility rule as grade. */
  feedback: string | null;
  /** Same visibility rule as grade. */
  gradedAt: Date | null;
  attachments: AttachedFileSummary[];
}

export interface SubmissionView {
  /** Null until the student's first Save Draft or Turn In - no row is created before that. */
  submission: SubmissionDetail | null;
  /** Whether the text response and attachments may currently be changed. */
  canEdit: boolean;
  /** Whether Unsubmit is currently allowed (turned in, assignment still accepting work). */
  canUnsubmit: boolean;
  /** Why the assignment has stopped accepting work, if it has. */
  lockReason: "CLOSED" | "PAST_DUE" | "ARCHIVED" | null;
}

export interface PrivateCommentSummary {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    image: string | null;
    isTeacher: boolean;
  };
  canDelete: boolean;
}

export interface StudentSubmissionRow {
  studentId: string;
  studentName: string;
  studentImage: string | null;
  /** Never "DRAFT" here - a student's in-progress draft is invisible to teachers. */
  displayStatus: SubmissionDisplayStatus;
  submittedAt: Date | null;
  updatedAt: Date | null;
  hasSubmission: boolean;
  grade: number | null;
}

export interface SubmissionOverview {
  totalStudents: number;
  submitted: number;
  notSubmitted: number;
  missing: number;
  late: number;
  returned: number;
  rows: StudentSubmissionRow[];
}

export interface SubmissionReviewDetail {
  student: { id: string; name: string; image: string | null };
  submission: SubmissionDetail | null;
  canReturn: boolean;
  /** Whether a grade may currently be assigned/edited (turned in, not yet returned, assignment has max points). */
  canGrade: boolean;
  comments: PrivateCommentSummary[];
}

export interface GradeSummary {
  gradedCount: number;
  pendingCount: number;
  returnedCount: number;
  averageGrade: number | null;
  highestGrade: number | null;
  lowestGrade: number | null;
}
