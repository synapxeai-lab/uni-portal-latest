import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet, isNotFoundError } from "@/lib/api";

import type { ReviewQueueResult, SubmissionReviewDetail } from "./types";

/** The review queue for the current URL filters (kept on screen while the next page loads). */
export function useReviewQueue(search: string) {
  return useQuery({
    queryKey: ["review", search],
    queryFn: () => apiGet<ReviewQueueResult>(`/review${search}`),
    placeholderData: keepPreviousData,
  });
}

/** Same signature as the old action: the review detail, or null when it isn't visible. */
export async function getReviewSubmissionDetailAction(
  classroomId: string,
  assignmentId: string,
  studentId: string,
): Promise<SubmissionReviewDetail | null> {
  try {
    const { detail } = await apiGet<{ detail: SubmissionReviewDetail }>(
      `/classrooms/${classroomId}/assignments/${assignmentId}/submissions/${studentId}`,
    );
    return detail;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}
