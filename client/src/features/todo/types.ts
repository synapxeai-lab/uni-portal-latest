import type { AttachedFileSummary } from "@/lib/file-attachments";
import type { SubmissionDisplayStatus } from "@/features/submissions/lib/display-status";
import type { AssignmentStatus } from "@portal/shared/enums";

/**
 * The three mutually-exclusive buckets every visible assignment falls into -
 * see services/todo-service.ts for the exact categorization rule. An
 * assignment is computed into exactly one of these, never more than one.
 */
export type TodoCategory = "assigned" | "missing" | "done";

export const TODO_CATEGORIES: TodoCategory[] = ["assigned", "missing", "done"];

/** Due-date grouping applied uniformly within every tab (see lib/todo-date.ts). */
export type TodoDueGroup = "no-due-date" | "this-week" | "next-week" | "later";

export const TODO_DUE_GROUPS: TodoDueGroup[] = ["no-due-date", "this-week", "next-week", "later"];

export interface TodoAssignmentItem {
  id: string;
  title: string;
  classroomId: string;
  classroomTitle: string;
  dueDate: Date | null;
  points: number | null;
  attachments: AttachedFileSummary[];
  /** Always PUBLISHED or CLOSED - a student never sees Draft/Scheduled assignments anywhere in this app. */
  assignmentStatus: AssignmentStatus;
  submissionStatus: SubmissionDisplayStatus;
  category: TodoCategory;
  dueGroup: TodoDueGroup;
}

export interface TodoFilters {
  classroomId?: string;
}

export interface TodoClassroomOption {
  id: string;
  title: string;
}
