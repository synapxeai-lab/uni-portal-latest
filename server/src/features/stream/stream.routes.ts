import { Router, type Request } from "express";
import { z } from "zod";

import { multipart } from "@/http/upload";
import { parseInput, parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateClassroom } from "@/lib/cache/tags";
import { extractUploadedFiles } from "@/lib/storage/extract-files";
import { AnnouncementStatus } from "@/generated/prisma/enums";
import { requireVisibleClassroom } from "@/features/classroom/classroom.routes";
import * as notificationService from "@/features/notifications/services/notification-service";

import * as streamService from "./services/stream-service";
import {
  announcementIdSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "./validation/announcement-schema";
import { createCommentSchema, deleteCommentSchema } from "./validation/comment-schema";

/** Mounted at /classrooms/:classroomId. */
export const streamRouter = Router({ mergeParams: true });

const STATUS_MAP = {
  DRAFT: AnnouncementStatus.DRAFT,
  SCHEDULED: AnnouncementStatus.SCHEDULED,
  PUBLISHED: AnnouncementStatus.PUBLISHED,
} as const;

function classroomIdOf(req: Request): string {
  return parseParams(
    z.object({ classroomId: z.string().uuid() }),
    req.params,
    "Invalid classroom id.",
  ).classroomId;
}

function announcementIdOf(req: Request): string {
  return parseParams(announcementIdSchema, req.params, "Invalid announcement.").announcementId;
}

streamRouter.get("/stream", async (req, res) => {
  const user = currentUser(req);
  const classroomId = classroomIdOf(req);
  await requireVisibleClassroom(classroomId, user);

  const announcements = await cached(
    `stream:${classroomId}:${user.id}`,
    { ttl: CacheTtl.CLASSROOM, tags: [CacheTags.ACADEMIC, CacheTags.classroom(classroomId)] },
    () => streamService.listClassroomAnnouncements(classroomId, user),
  );
  res.json(announcements);
});

/**
 * Change fingerprint for the stream, polled every few seconds by open stream
 * pages to pick up other members' posts and comments. Never cached.
 */
streamRouter.get("/stream/version", async (req, res) => {
  const version = await streamService.getStreamVersion(classroomIdOf(req), currentUser(req));
  res.set("Cache-Control", "no-store").json({ version });
});

/**
 * Marks the caller's announcement/class-comment notifications for this
 * classroom as read - called while the stream is open and visible. Scoped to
 * the caller's own notifications, so no membership check is needed.
 */
streamRouter.post("/stream/notifications/read", async (req, res) => {
  const count = await notificationService.markStreamNotificationsRead(
    currentUser(req).id,
    classroomIdOf(req),
  );
  res.set("Cache-Control", "no-store").json({ count });
});

streamRouter.post("/announcements", multipart, async (req, res) => {
  const input = parseInput(createAnnouncementSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
  });
  const announcement = await streamService.createAnnouncement(
    input.classroomId,
    currentUser(req),
    input.content,
    STATUS_MAP[input.status],
    input.scheduledFor ? new Date(input.scheduledFor) : null,
    extractUploadedFiles(req),
  );
  invalidateClassroom(input.classroomId);
  res.status(201).json({ status: "success", data: announcement });
});

streamRouter.patch("/announcements/:announcementId", multipart, async (req, res) => {
  const input = parseInput(updateAnnouncementSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
    announcementId: req.params.announcementId,
  });
  const announcement = await streamService.updateAnnouncement(
    input.announcementId,
    currentUser(req),
    input.content,
    extractUploadedFiles(req),
  );
  invalidateClassroom(input.classroomId);
  res.json({ status: "success", data: announcement });
});

streamRouter.delete("/announcements/:announcementId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  await streamService.deleteAnnouncement(announcementIdOf(req), currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

streamRouter.post("/announcements/:announcementId/pin", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const pinned = req.body?.pinned === true;
  const announcement = await streamService.setAnnouncementPinned(
    announcementIdOf(req),
    currentUser(req),
    pinned,
  );
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: announcement });
});

streamRouter.delete(
  "/announcements/:announcementId/attachments/:fileAttachmentId",
  async (req, res) => {
    const classroomId = classroomIdOf(req);
    const { fileAttachmentId } = parseParams(
      z.object({ fileAttachmentId: z.string().uuid() }),
      req.params,
      "Invalid attachment.",
    );
    await streamService.removeAnnouncementAttachment(
      announcementIdOf(req),
      fileAttachmentId,
      currentUser(req),
    );
    invalidateClassroom(classroomId);
    res.json({ status: "success", data: undefined });
  },
);

streamRouter.post("/announcements/:announcementId/comments", async (req, res) => {
  const input = parseInput(createCommentSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
    announcementId: req.params.announcementId,
  });
  const comment = await streamService.createComment(
    input.announcementId,
    currentUser(req),
    input.content,
  );
  invalidateClassroom(input.classroomId);
  res.status(201).json({ status: "success", data: comment });
});

streamRouter.delete("/comments/:commentId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { commentId } = parseParams(deleteCommentSchema, req.params, "Invalid comment.");
  await streamService.deleteComment(commentId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});
