import { apiAction, apiGet, getApiError } from "@/lib/api";
import { api } from "@/lib/api";

import type { ActionResult, NotificationPage, NotificationType } from "./types";

interface ListInput {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

function toParams(input: ListInput) {
  return {
    cursor: input.cursor,
    limit: input.limit,
    unreadOnly: input.unreadOnly ? "true" : undefined,
    type: input.type,
  };
}

// Same signatures as the old Server Actions.

export async function getNotificationsAction(
  input: ListInput = {},
): Promise<ActionResult<NotificationPage>> {
  try {
    const page = await apiGet<NotificationPage>("/notifications", { params: toParams(input) });
    return { status: "success", data: page };
  } catch (error) {
    return {
      status: "error",
      message: getApiError(error)?.message ?? "Couldn't load notifications. Please try again.",
    };
  }
}

/** Opening the Notifications page marks everything read and returns the first page. */
export async function openNotifications(input: ListInput = {}): Promise<NotificationPage> {
  const response = await api.post<NotificationPage>("/notifications/open", undefined, {
    params: toParams(input),
  });
  return response.data;
}

export function markNotificationReadAction(notificationId: string) {
  return apiAction(
    "post",
    `/notifications/${notificationId}/read`,
    undefined,
    "Couldn't mark this notification as read. Please try again.",
  );
}

export function markAllNotificationsReadAction() {
  return apiAction<{ updated: number }>(
    "post",
    "/notifications/read-all",
    undefined,
    "Couldn't mark all notifications as read. Please try again.",
  );
}

export function deleteNotificationAction(notificationId: string) {
  return apiAction(
    "delete",
    `/notifications/${notificationId}`,
    undefined,
    "Couldn't delete this notification. Please try again.",
  );
}
