import { useQuery } from "@tanstack/react-query";

import type { AssignmentSummary } from "@/features/classwork/types";
import { apiAction, apiGet } from "@/lib/api";

import type {
  ActionResult,
  GradeSummary,
  PrivateCommentSummary,
  SubmissionOverview,
  SubmissionReviewDetail,
  SubmissionView,
} from "./types";

// ---- Queries ------------------------------------------------------------------

export type SubmissionPanelData =
  | { kind: "teacher"; overview: SubmissionOverview; gradeSummary: GradeSummary }
  | { kind: "student"; view: SubmissionView; comments: PrivateCommentSummary[] };

function base(classroomId: string, assignmentId: string): string {
  return `/classrooms/${classroomId}/assignments/${assignmentId}`;
}

export const submissionKeys = {
  panel: (classroomId: string, assignmentId: string) =>
    ["submissions", classroomId, assignmentId, "panel"] as const,
  list: (classroomId: string, assignmentId: string) =>
    ["submissions", classroomId, assignmentId, "list"] as const,
  detail: (classroomId: string, assignmentId: string, studentId: string) =>
    ["submissions", classroomId, assignmentId, "student", studentId] as const,
};

export function useSubmissionPanel(classroomId: string, assignmentId: string) {
  return useQuery({
    queryKey: submissionKeys.panel(classroomId, assignmentId),
    queryFn: () =>
      apiGet<SubmissionPanelData>(`${base(classroomId, assignmentId)}/submission-panel`),
  });
}

export function useSubmissionList(classroomId: string, assignmentId: string) {
  return useQuery({
    queryKey: submissionKeys.list(classroomId, assignmentId),
    queryFn: () =>
      apiGet<{ assignment: AssignmentSummary; overview: SubmissionOverview }>(
        `${base(classroomId, assignmentId)}/submissions`,
      ),
  });
}

export function useSubmissionReview(classroomId: string, assignmentId: string, studentId: string) {
  return useQuery({
    queryKey: submissionKeys.detail(classroomId, assignmentId, studentId),
    queryFn: () =>
      apiGet<{ assignment: AssignmentSummary; detail: SubmissionReviewDetail }>(
        `${base(classroomId, assignmentId)}/submissions/${studentId}`,
      ),
  });
}

// ---- Mutations (same signatures as the old Server Actions) ---------------------

function ids(formData: FormData) {
  return {
    classroomId: String(formData.get("classroomId") ?? ""),
    assignmentId: String(formData.get("assignmentId") ?? ""),
  };
}

export function saveSubmissionDraftAction(
  formData: FormData,
): Promise<ActionResult<SubmissionView>> {
  const { classroomId, assignmentId } = ids(formData);
  return apiAction<SubmissionView>(
    "post",
    `${base(classroomId, assignmentId)}/submission/draft`,
    formData,
    "Couldn't save your draft. Please try again.",
  );
}

export function submitAssignmentAction(formData: FormData): Promise<ActionResult<SubmissionView>> {
  const { classroomId, assignmentId } = ids(formData);
  return apiAction<SubmissionView>(
    "post",
    `${base(classroomId, assignmentId)}/submission/submit`,
    formData,
    "Couldn't turn in your assignment. Please try again.",
  );
}

export function unsubmitAssignmentAction(classroomId: string, assignmentId: string) {
  return apiAction<SubmissionView>(
    "post",
    `${base(classroomId, assignmentId)}/submission/unsubmit`,
    undefined,
    "Couldn't unsubmit your work. Please try again.",
  );
}

export function removeSubmissionAttachmentAction(
  classroomId: string,
  assignmentId: string,
  submissionId: string,
  fileAttachmentId: string,
) {
  return apiAction(
    "delete",
    `${base(classroomId, assignmentId)}/submission/${submissionId}/attachments/${fileAttachmentId}`,
    undefined,
    "Couldn't remove that attachment. Please try again.",
  );
}

export function createPrivateCommentAction(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  content: string,
) {
  return apiAction<PrivateCommentSummary>(
    "post",
    `${base(classroomId, assignmentId)}/submissions/${studentId}/comments`,
    { content },
    "Couldn't post your comment. Please try again.",
  );
}

export function deletePrivateCommentAction(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  commentId: string,
) {
  return apiAction(
    "delete",
    `${base(classroomId, assignmentId)}/submissions/${studentId}/comments/${commentId}`,
    undefined,
    "Couldn't delete your comment. Please try again.",
  );
}

/** Sends work back to the student for revision, with a note on what to improve. Not a grade. */
export function returnForRevisionAction(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  note: string | undefined,
) {
  return apiAction<SubmissionReviewDetail>(
    "post",
    `${base(classroomId, assignmentId)}/submissions/${studentId}/return`,
    { note },
    "Couldn't return this work. Please try again.",
  );
}

function saveGrade(
  classroomId: string,
  assignmentId: string,
  studentId: string,
  grade: number,
  feedback: string | undefined,
) {
  return apiAction<SubmissionReviewDetail>(
    "put",
    `${base(classroomId, assignmentId)}/submissions/${studentId}/grade`,
    { grade, feedback },
    "Couldn't save the grade. Please try again.",
  );
}

export const gradeSubmissionAction = saveGrade;
export const updateGradeAction = saveGrade;
