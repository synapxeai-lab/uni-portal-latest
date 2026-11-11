import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiAction, apiGet, formDataToObject } from "@/lib/api";

import type {
  ActionResult,
  AdminClassroomDetail,
  AdminClassroomMember,
  AdminClassroomSummary,
  ClassroomsPage,
} from "./types";

/** The classrooms table for the current URL filters (kept on screen while the next page loads). */
export function useAdminClassroomsPage(search: string) {
  return useQuery({
    queryKey: ["admin", "classrooms", search],
    queryFn: () => apiGet<ClassroomsPage>(`/admin/classrooms${search}`),
    placeholderData: keepPreviousData,
  });
}

// ---- Same signatures as the old Server Actions ------------------------------------

export function getClassroomDetailAction(classroomId: string): Promise<AdminClassroomDetail> {
  return apiGet<AdminClassroomDetail>(`/admin/classrooms/${classroomId}`);
}

export function archiveClassroomAction(classroomId: string) {
  return apiAction<AdminClassroomSummary>(
    "post",
    `/admin/classrooms/${classroomId}/archive`,
    undefined,
    "Couldn't archive this classroom. Please try again.",
  );
}

export function restoreClassroomAction(classroomId: string) {
  return apiAction<AdminClassroomSummary>(
    "post",
    `/admin/classrooms/${classroomId}/restore`,
    undefined,
    "Couldn't restore this classroom. Please try again.",
  );
}

export function deleteClassroomAction(classroomId: string) {
  return apiAction<AdminClassroomSummary>(
    "delete",
    `/admin/classrooms/${classroomId}`,
    undefined,
    "Couldn't delete this classroom. Please try again.",
  );
}

export function transferOwnershipAction(
  _prevState: ActionResult<AdminClassroomSummary> | null,
  formData: FormData,
): Promise<ActionResult<AdminClassroomSummary>> {
  const { classroomId, ...body } = formDataToObject(formData);
  return apiAction<AdminClassroomSummary>(
    "post",
    `/admin/classrooms/${classroomId}/transfer`,
    body,
    "Couldn't transfer ownership. Please try again.",
  );
}

export function assignTeacherAction(
  _prevState: ActionResult<AdminClassroomMember> | null,
  formData: FormData,
): Promise<ActionResult<AdminClassroomMember>> {
  const { classroomId, ...body } = formDataToObject(formData);
  return apiAction<AdminClassroomMember>(
    "post",
    `/admin/classrooms/${classroomId}/teachers`,
    body,
    "Couldn't assign this teacher. Please try again.",
  );
}
