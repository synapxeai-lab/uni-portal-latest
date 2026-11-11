import type { SubmissionStatus } from "@portal/shared/enums";

export type { ActionResult } from "@/types/action-result";
export type { SubmissionReviewDetail } from "@/features/submissions/types";

export type ReviewSortKey = "newest" | "oldest" | "dueDate" | "studentName" | "assignmentName";

/** Collapsed, presentational status - mirrors submissions' displayStatus vocabulary, minus NOT_SUBMITTED/DRAFT which never appear in this queue. */
export type ReviewDisplayStatus = "SUBMITTED" | "LATE" | "RETURNED";

export interface ReviewQueueFilters {
  classroomId?: string;
  assignmentId?: string;
  studentId?: string;
  status?: ReviewDisplayStatus;
  /** Only submissions whose assignment is due on or before this date. */
  dueBefore?: string;
  page: number;
  sort: ReviewSortKey;
}

export interface ReviewQueueRow {
  submissionId: string;
  classroomId: string;
  classroomTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  studentImage: string | null;
  status: SubmissionStatus;
  displayStatus: ReviewDisplayStatus;
  submittedAt: Date | null;
  dueDate: Date | null;
  grade: number | null;
  maxPoints: number | null;
}

export interface ReviewQueueSummary {
  pendingReviews: number;
  lateSubmissions: number;
  returnedToday: number;
  recentlySubmitted: number;
}

export interface ReviewFilterOptions {
  classrooms: { id: string; title: string }[];
  assignments: { id: string; title: string; classroomId: string }[];
  students: { id: string; name: string; classroomId: string }[];
}

export interface ReviewQueueResult {
  rows: ReviewQueueRow[];
  summary: ReviewQueueSummary;
  filterOptions: ReviewFilterOptions;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
