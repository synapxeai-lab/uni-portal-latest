import { useQuery } from "@tanstack/react-query";

import { apiAction, apiGet } from "@/lib/api";
import { navigateTo } from "@/lib/navigate";
import { queryClient } from "@/lib/query-client";

import type { ActionResult, ClassroomRoster, ClassroomSummary, PendingInvitation } from "./types";

// ---- Queries ----------------------------------------------------------------

export const classroomKeys = {
  all: ["classrooms"] as const,
  list: () => ["classrooms", "list"] as const,
  archived: () => ["classrooms", "archived"] as const,
  detail: (classroomId: string) => ["classrooms", "detail", classroomId] as const,
  people: (classroomId: string) => ["classrooms", "people", classroomId] as const,
};

export function useClassrooms() {
  return useQuery({
    queryKey: classroomKeys.list(),
    queryFn: () => apiGet<ClassroomSummary[]>("/classrooms"),
  });
}

export function useArchivedClassrooms() {
  return useQuery({
    queryKey: classroomKeys.archived(),
    queryFn: () => apiGet<ClassroomSummary[]>("/classrooms/archived"),
  });
}

export function useClassroom(classroomId: string) {
  return useQuery({
    queryKey: classroomKeys.detail(classroomId),
    queryFn: () => apiGet<ClassroomSummary>(`/classrooms/${classroomId}`),
  });
}

export interface ClassroomPeople {
  roster: ClassroomRoster;
  invitations: PendingInvitation[];
}

export function useClassroomPeople(classroomId: string) {
  return useQuery({
    queryKey: classroomKeys.people(classroomId),
    queryFn: () => apiGet<ClassroomPeople>(`/classrooms/${classroomId}/people`),
  });
}

// ---- Mutations (same signatures as the old Server Actions) -------------------

/** After any change to classes: everything that lists or shows them refetches. */
function refreshAfterSuccess<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.status === "success") {
    void queryClient.invalidateQueries();
  }
  return result;
}

export async function createClassroomAction(
  _prevState: ActionResult<ClassroomSummary> | null,
  formData: FormData,
): Promise<ActionResult<ClassroomSummary>> {
  const result = refreshAfterSuccess(
    await apiAction<ClassroomSummary>(
      "post",
      "/classrooms",
      formData,
      "Couldn't create the class. Please try again.",
    ),
  );
  if (result.status === "success") {
    navigateTo(`/classes/${result.data.id}/stream`);
  }
  return result;
}

export async function updateClassroomAction(
  _prevState: ActionResult<ClassroomSummary> | null,
  formData: FormData,
): Promise<ActionResult<ClassroomSummary>> {
  const classroomId = String(formData.get("classroomId") ?? "");
  return refreshAfterSuccess(
    await apiAction<ClassroomSummary>(
      "patch",
      `/classrooms/${classroomId}`,
      formData,
      "Couldn't update the class. Please try again.",
    ),
  );
}

export async function joinClassroomAction(
  _prevState: ActionResult<ClassroomSummary> | null,
  formData: FormData,
): Promise<ActionResult<ClassroomSummary>> {
  const result = refreshAfterSuccess(
    await apiAction<ClassroomSummary>(
      "post",
      "/classrooms/join",
      { code: formData.get("code") },
      "Couldn't join the class. Please try again.",
    ),
  );
  if (result.status === "success") {
    navigateTo(`/classes/${result.data.id}/stream`);
  }
  return result;
}

export async function archiveClassroomAction(classroomId: string) {
  return refreshAfterSuccess(
    await apiAction(
      "post",
      `/classrooms/${classroomId}/archive`,
      undefined,
      "Couldn't archive the class. Please try again.",
    ),
  );
}

export async function restoreClassroomAction(classroomId: string) {
  return refreshAfterSuccess(
    await apiAction(
      "post",
      `/classrooms/${classroomId}/restore`,
      undefined,
      "Couldn't restore the class. Please try again.",
    ),
  );
}

export async function leaveClassroomAction(classroomId: string) {
  return refreshAfterSuccess(
    await apiAction(
      "post",
      `/classrooms/${classroomId}/leave`,
      undefined,
      "Couldn't leave the class. Please try again.",
    ),
  );
}

export async function removeMemberAction(classroomId: string, userId: string) {
  return refreshAfterSuccess(
    await apiAction(
      "delete",
      `/classrooms/${classroomId}/members/${userId}`,
      undefined,
      "Couldn't remove this member. Please try again.",
    ),
  );
}

export async function changeMemberRoleAction(classroomId: string, userId: string, role: string) {
  return refreshAfterSuccess(
    await apiAction(
      "patch",
      `/classrooms/${classroomId}/members/${userId}`,
      { role },
      "Couldn't change this member's role. Please try again.",
    ),
  );
}

export async function inviteMemberAction(
  _prevState: ActionResult<PendingInvitation> | null,
  formData: FormData,
): Promise<ActionResult<PendingInvitation>> {
  const classroomId = String(formData.get("classroomId") ?? "");
  return refreshAfterSuccess(
    await apiAction<PendingInvitation>(
      "post",
      `/classrooms/${classroomId}/invitations`,
      { email: formData.get("email") },
      "Couldn't send the invitation. Please try again.",
    ),
  );
}

export async function cancelInvitationAction(classroomId: string, invitationId: string) {
  return refreshAfterSuccess(
    await apiAction(
      "delete",
      `/classrooms/${classroomId}/invitations/${invitationId}`,
      undefined,
      "Couldn't cancel the invitation. Please try again.",
    ),
  );
}
