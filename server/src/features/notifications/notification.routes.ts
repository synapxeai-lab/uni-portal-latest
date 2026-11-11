import { Router, type Request } from "express";

import { badRequest } from "@/http/errors";
import { parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";

import * as notificationService from "./services/notification-service";
import { listNotificationsSchema, notificationIdSchema } from "./validation/notification-schema";

export const notificationRouter = Router();

// Notifications are per-user and change constantly - never cached.

function listOptions(req: Request) {
  const query = req.query;
  const parsed = listNotificationsSchema.safeParse({
    cursor: typeof query.cursor === "string" && query.cursor ? query.cursor : undefined,
    limit: typeof query.limit === "string" ? query.limit : undefined,
    // Query strings are text - only "true" means true.
    unreadOnly: query.unreadOnly === "true",
    type: typeof query.type === "string" && query.type ? query.type : undefined,
  });
  if (!parsed.success) {
    throw badRequest("Invalid request.");
  }
  return parsed.data;
}

function notificationIdOf(req: Request): string {
  return parseParams(notificationIdSchema, req.params, "Invalid notification.").notificationId;
}

/**
 * Unread-notification count, polled by the client's UnreadCountProvider
 * (every 15s, and on navigation/focus once the count is >10s old).
 */
notificationRouter.get("/unread-count", async (req, res) => {
  const count = await notificationService.getUnreadCount(currentUser(req).id);
  res.set("Cache-Control", "no-store").json({ count });
});

/** A page of notifications (cursor-paginated, newest first). */
notificationRouter.get("/", async (req, res) => {
  const page = await notificationService.listNotifications(currentUser(req).id, listOptions(req));
  res.set("Cache-Control", "no-store").json(page);
});

/**
 * Opening the Notifications page counts as reading everything: marks all read
 * and returns the first page, in one round trip.
 */
notificationRouter.post("/open", async (req, res) => {
  const userId = currentUser(req).id;
  await notificationService.markAllNotificationsRead(userId);
  const page = await notificationService.listNotifications(userId, listOptions(req));
  res.set("Cache-Control", "no-store").json(page);
});

notificationRouter.post("/read-all", async (req, res) => {
  const updated = await notificationService.markAllNotificationsRead(currentUser(req).id);
  res.json({ status: "success", data: { updated } });
});

notificationRouter.post("/:notificationId/read", async (req, res) => {
  await notificationService.markNotificationRead(notificationIdOf(req), currentUser(req).id);
  res.json({ status: "success", data: undefined });
});

notificationRouter.delete("/:notificationId", async (req, res) => {
  await notificationService.deleteNotification(notificationIdOf(req), currentUser(req).id);
  res.json({ status: "success", data: undefined });
});
