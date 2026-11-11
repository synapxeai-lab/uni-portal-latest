import { useQuery } from "@tanstack/react-query";

import { apiAction, apiGet } from "@/lib/api";

import type { ActionResult, AssignmentSummary, MaterialSummary, TopicSummary } from "./types";

// ---- Queries ------------------------------------------------------------------

export interface ClassworkData {
  topics: TopicSummary[];
  materials: MaterialSummary[];
  assignments: AssignmentSummary[];
}

export interface AssignmentDetailData {
  assignment: AssignmentSummary;
  topics: TopicSummary[];
}

export const classworkKeys = {
  list: (classroomId: string) => ["classwork", classroomId] as const,
  assignment: (classroomId: string, assignmentId: string) =>
    ["classwork", classroomId, "assignment", assignmentId] as const,
};

export function useClasswork(classroomId: string) {
  return useQuery({
    queryKey: classworkKeys.list(classroomId),
    queryFn: () => apiGet<ClassworkData>(`/classrooms/${classroomId}/classwork`),
  });
}

export function useAssignmentDetail(classroomId: string, assignmentId: string) {
  return useQuery({
    queryKey: classworkKeys.assignment(classroomId, assignmentId),
    queryFn: () =>
      apiGet<AssignmentDetailData>(`/classrooms/${classroomId}/assignments/${assignmentId}`),
  });
}

// ---- Mutations (same signatures as the old Server Actions) ---------------------
// Components call router.refresh() after a success, which refetches the page.

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

export function createTopicAction(
  _prevState: ActionResult<TopicSummary> | null,
  formData: FormData,
): Promise<ActionResult<TopicSummary>> {
  return apiAction<TopicSummary>(
    "post",
    `/classrooms/${field(formData, "classroomId")}/topics`,
    { title: formData.get("title") },
    "Couldn't create the topic. Please try again.",
  );
}

export function renameTopicAction(
  _prevState: ActionResult<TopicSummary> | null,
  formData: FormData,
): Promise<ActionResult<TopicSummary>> {
  return apiAction<TopicSummary>(
    "patch",
    `/classrooms/${field(formData, "classroomId")}/topics/${field(formData, "topicId")}`,
    { title: formData.get("title") },
    "Couldn't rename the topic. Please try again.",
  );
}

export function deleteTopicAction(classroomId: string, topicId: string) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/topics/${topicId}`,
    undefined,
    "Couldn't delete the topic. Please try again.",
  );
}

export function reorderTopicsAction(classroomId: string, orderedTopicIds: string[]) {
  return apiAction(
    "put",
    `/classrooms/${classroomId}/topics/order`,
    { orderedTopicIds },
    "Couldn't save the new topic order. Please try again.",
  );
}

export function createMaterialAction(
  _prevState: ActionResult<MaterialSummary> | null,
  formData: FormData,
): Promise<ActionResult<MaterialSummary>> {
  return apiAction<MaterialSummary>(
    "post",
    `/classrooms/${field(formData, "classroomId")}/materials`,
    formData,
    "Couldn't create the material. Please try again.",
  );
}

export function updateMaterialAction(
  _prevState: ActionResult<MaterialSummary> | null,
  formData: FormData,
): Promise<ActionResult<MaterialSummary>> {
  return apiAction<MaterialSummary>(
    "patch",
    `/classrooms/${field(formData, "classroomId")}/materials/${field(formData, "materialId")}`,
    formData,
    "Couldn't update the material. Please try again.",
  );
}

export function deleteMaterialAction(classroomId: string, materialId: string) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/materials/${materialId}`,
    undefined,
    "Couldn't delete the material. Please try again.",
  );
}

export function removeMaterialAttachmentAction(
  classroomId: string,
  materialId: string,
  fileAttachmentId: string,
) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/materials/${materialId}/attachments/${fileAttachmentId}`,
    undefined,
    "Couldn't remove that attachment. Please try again.",
  );
}

export function createAssignmentAction(
  _prevState: ActionResult<AssignmentSummary> | null,
  formData: FormData,
): Promise<ActionResult<AssignmentSummary>> {
  return apiAction<AssignmentSummary>(
    "post",
    `/classrooms/${field(formData, "classroomId")}/assignments`,
    formData,
    "Couldn't create the assignment. Please try again.",
  );
}

export function updateAssignmentAction(
  _prevState: ActionResult<AssignmentSummary> | null,
  formData: FormData,
): Promise<ActionResult<AssignmentSummary>> {
  return apiAction<AssignmentSummary>(
    "patch",
    `/classrooms/${field(formData, "classroomId")}/assignments/${field(formData, "assignmentId")}`,
    formData,
    "Couldn't update the assignment. Please try again.",
  );
}

export function closeAssignmentAction(classroomId: string, assignmentId: string) {
  return apiAction(
    "post",
    `/classrooms/${classroomId}/assignments/${assignmentId}/close`,
    undefined,
    "Couldn't close the assignment. Please try again.",
  );
}

export function deleteAssignmentAction(classroomId: string, assignmentId: string) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/assignments/${assignmentId}`,
    undefined,
    "Couldn't delete the assignment. Please try again.",
  );
}

export function removeAssignmentAttachmentAction(
  classroomId: string,
  assignmentId: string,
  fileAttachmentId: string,
) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/assignments/${assignmentId}/attachments/${fileAttachmentId}`,
    undefined,
    "Couldn't remove that attachment. Please try again.",
  );
}
