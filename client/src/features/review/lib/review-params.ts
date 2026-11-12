import type { ReviewDisplayStatus, ReviewQueueFilters, ReviewSortKey } from "../types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORT_KEYS: ReviewSortKey[] = ["newest", "oldest", "dueDate", "studentName", "assignmentName"];
const STATUS_VALUES: ReviewDisplayStatus[] = ["SUBMITTED", "LATE", "GRADED", "RETURNED"];

function getStringParam(searchParams: RawSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseReviewFilters(searchParams: RawSearchParams): ReviewQueueFilters {
  const sortParam = getStringParam(searchParams, "sort");
  const statusParam = getStringParam(searchParams, "status");
  const pageParam = getStringParam(searchParams, "page");

  const page = pageParam ? Math.max(1, Number.parseInt(pageParam, 10) || 1) : 1;

  return {
    classroomId: getStringParam(searchParams, "classroomId"),
    assignmentId: getStringParam(searchParams, "assignmentId"),
    studentId: getStringParam(searchParams, "studentId"),
    status:
      statusParam && STATUS_VALUES.includes(statusParam as ReviewDisplayStatus)
        ? (statusParam as ReviewDisplayStatus)
        : undefined,
    dueBefore: getStringParam(searchParams, "dueBefore"),
    page,
    sort:
      sortParam && SORT_KEYS.includes(sortParam as ReviewSortKey)
        ? (sortParam as ReviewSortKey)
        : "newest",
  };
}
