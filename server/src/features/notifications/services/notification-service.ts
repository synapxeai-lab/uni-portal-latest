import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/enums";

import { NotificationServiceError } from "../lib/errors";
import type { NotificationPage, NotificationSummary } from "../types";

export interface ListNotificationsOptions {
  cursor?: string;
  limit: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

function toNotificationSummary(notification: {
  id: string;
  type: NotificationSummary["type"];
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}): NotificationSummary {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

/** Every read and write here is scoped to `userId` - callers never pass an
 * arbitrary recipientId, so "users may only access their own notifications"
 * holds by construction rather than by a bolted-on check. */
export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions,
): Promise<NotificationPage> {
  const rows = await prisma.notification.findMany({
    where: {
      recipientId: userId,
      deletedAt: null,
      ...(options.unreadOnly ? { isRead: false } : {}),
      ...(options.type ? { type: options.type } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;

  return {
    notifications: page.map(toNotificationSummary),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId: userId, deletedAt: null, isRead: false },
  });
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  // A single scoped updateMany both enforces ownership and performs the write -
  // there's no separate "fetch then check owner then update" window where a
  // caller could race or a check could be forgotten.
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, deletedAt: null },
    data: { isRead: true },
  });

  if (result.count === 0) {
    throw new NotificationServiceError("NOT_FOUND", "Notification not found.");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, deletedAt: null, isRead: false },
    data: { isRead: true },
  });

  return result.count;
}

// The notification types that are about something shown on a classroom's stream.
const STREAM_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.NEW_ANNOUNCEMENT,
  NotificationType.CLASS_COMMENT,
];

/** Marks the user's unread announcement/class-comment notifications for one
 * classroom as read - called while they are looking at that classroom's
 * stream, since they can already see whatever the notifications are about. */
export async function markStreamNotificationsRead(
  userId: string,
  classroomId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      recipientId: userId,
      classroomId,
      type: { in: STREAM_NOTIFICATION_TYPES },
      deletedAt: null,
      isRead: false,
    },
    data: { isRead: true },
  });

  return result.count;
}

export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    throw new NotificationServiceError("NOT_FOUND", "Notification not found.");
  }
}
