import { useQuery } from "@tanstack/react-query";

import { api, apiAction, apiGet } from "@/lib/api";

import type { ActionResult, AnnouncementSummary, CommentSummary } from "./types";

export const streamKeys = {
  announcements: (classroomId: string) => ["stream", classroomId] as const,
  version: (classroomId: string) => ["stream-version", classroomId] as const,
};

export function useAnnouncements(classroomId: string) {
  return useQuery({
    queryKey: streamKeys.announcements(classroomId),
    queryFn: () => apiGet<AnnouncementSummary[]>(`/classrooms/${classroomId}/stream`),
  });
}

export async function fetchStreamVersion(classroomId: string): Promise<string> {
  const body = await apiGet<{ version?: unknown }>(`/classrooms/${classroomId}/stream/version`);
  if (typeof body.version !== "string") {
    throw new Error("Stream version response was malformed");
  }
  return body.version;
}

export async function markStreamNotificationsRead(classroomId: string): Promise<void> {
  await api.post(`/classrooms/${classroomId}/stream/notifications/read`);
}

// ---- Mutations (same signatures as the old Server Actions) -------------------
// Components call router.refresh() after a success, which refetches the stream.

export function createAnnouncementAction(
  _prevState: ActionResult<AnnouncementSummary> | null,
  formData: FormData,
): Promise<ActionResult<AnnouncementSummary>> {
  const classroomId = String(formData.get("classroomId") ?? "");
  return apiAction<AnnouncementSummary>(
    "post",
    `/classrooms/${classroomId}/announcements`,
    formData,
    "Couldn't post the announcement. Please try again.",
  );
}

export function updateAnnouncementAction(
  _prevState: ActionResult<AnnouncementSummary> | null,
  formData: FormData,
): Promise<ActionResult<AnnouncementSummary>> {
  const classroomId = String(formData.get("classroomId") ?? "");
  const announcementId = String(formData.get("announcementId") ?? "");
  return apiAction<AnnouncementSummary>(
    "patch",
    `/classrooms/${classroomId}/announcements/${announcementId}`,
    formData,
    "Couldn't update the announcement. Please try again.",
  );
}

export function deleteAnnouncementAction(classroomId: string, announcementId: string) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/announcements/${announcementId}`,
    undefined,
    "Couldn't delete the announcement. Please try again.",
  );
}

export function setAnnouncementPinnedAction(
  classroomId: string,
  announcementId: string,
  pinned: boolean,
) {
  return apiAction<AnnouncementSummary>(
    "post",
    `/classrooms/${classroomId}/announcements/${announcementId}/pin`,
    { pinned },
    pinned
      ? "Couldn't pin the announcement. Please try again."
      : "Couldn't unpin the announcement. Please try again.",
  );
}

export function removeAnnouncementAttachmentAction(
  classroomId: string,
  announcementId: string,
  fileAttachmentId: string,
) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/announcements/${announcementId}/attachments/${fileAttachmentId}`,
    undefined,
    "Couldn't remove that attachment. Please try again.",
  );
}

export function createCommentAction(
  _prevState: ActionResult<CommentSummary> | null,
  formData: FormData,
): Promise<ActionResult<CommentSummary>> {
  const classroomId = String(formData.get("classroomId") ?? "");
  const announcementId = String(formData.get("announcementId") ?? "");
  return apiAction<CommentSummary>(
    "post",
    `/classrooms/${classroomId}/announcements/${announcementId}/comments`,
    { content: formData.get("content") },
    "Couldn't post the comment. Please try again.",
  );
}

export function deleteCommentAction(classroomId: string, commentId: string) {
  return apiAction(
    "delete",
    `/classrooms/${classroomId}/comments/${commentId}`,
    undefined,
    "Couldn't delete the comment. Please try again.",
  );
}
