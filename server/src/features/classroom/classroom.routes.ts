import { Router, type Request } from "express";
import { z } from "zod";

import { notFound } from "@/http/errors";
import { REPLACEABLE_IMAGE_CACHE_CONTROL, sendStoredFile } from "@/http/stored-file";
import { multipart } from "@/http/upload";
import { parseInput, parseParams } from "@/http/validate";
import { currentUser, requireTeacherOrAdmin } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateClassroom } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { extractUploadedFiles } from "@/lib/storage/extract-files";
import { getImageMimeType } from "@/lib/storage/image-mime";
import type { SessionUser } from "@/auth/session";

import { canManageClassroom } from "./lib/can-manage";
import { ClassroomServiceError } from "./lib/errors";
import * as classroomService from "./services/classroom-service";
import * as invitationService from "./services/invitation-service";
import type { ClassroomSummary } from "./types";
import {
  createClassroomSchema,
  joinClassroomSchema,
  updateClassroomSchema,
} from "./validation/classroom-schema";
import { inviteMemberSchema, cancelInvitationSchema } from "./validation/invitation-schema";
import { changeMemberRoleSchema, removeMemberSchema } from "./validation/member-schema";

export const classroomRouter = Router();

const classroomIdParam = z.object({ classroomId: z.string().uuid() });

function classroomIdOf(req: Request): string {
  return parseParams(classroomIdParam, req.params, "Invalid classroom id.").classroomId;
}

// ---- Cached reads -----------------------------------------------------------
// Authorization happens inside the service and the user id is part of every
// key, so an entry is only ever served back to the user it was computed for.

export function getCachedClassroomForUser(
  classroomId: string,
  user: SessionUser,
): Promise<ClassroomSummary> {
  return cached(
    `classroom:${classroomId}:${user.id}:${user.role}`,
    {
      ttl: CacheTtl.CLASSROOM,
      tags: [CacheTags.ACADEMIC, CacheTags.classroom(classroomId), CacheTags.user(user.id)],
    },
    () => classroomService.getClassroomForUser(classroomId, user),
  );
}

/**
 * A classroom the viewer can see, or a 404 - "doesn't exist" and "not yours"
 * are deliberately indistinguishable, like the old notFound() pages.
 */
export async function requireVisibleClassroom(
  classroomId: string,
  user: SessionUser,
): Promise<ClassroomSummary> {
  try {
    return await getCachedClassroomForUser(classroomId, user);
  } catch (error) {
    if (
      error instanceof ClassroomServiceError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      throw notFound("Class not found.");
    }
    throw error;
  }
}

classroomRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const classrooms = await cached(
    `classrooms:${user.id}`,
    {
      ttl: CacheTtl.LIVE,
      tags: [CacheTags.ACADEMIC, CacheTags.AGGREGATES, CacheTags.user(user.id)],
    },
    () => classroomService.listUserClassrooms(user.id),
  );
  res.json(classrooms);
});

classroomRouter.get("/archived", async (req, res) => {
  const user = currentUser(req);
  const classrooms = await cached(
    `classrooms-archived:${user.id}:${user.role}`,
    {
      ttl: CacheTtl.LIVE,
      tags: [CacheTags.ACADEMIC, CacheTags.AGGREGATES, CacheTags.user(user.id)],
    },
    () => classroomService.listArchivedClassrooms(user),
  );
  res.json(classrooms);
});

classroomRouter.get("/:classroomId", async (req, res) => {
  res.json(await requireVisibleClassroom(classroomIdOf(req), currentUser(req)));
});

/** Everything the People tab renders: roster, plus pending invitations for managers. */
classroomRouter.get("/:classroomId/people", async (req, res) => {
  const user = currentUser(req);
  const classroomId = classroomIdOf(req);
  const classroom = await requireVisibleClassroom(classroomId, user);
  const canManage = canManageClassroom(classroom.role);
  const tags = [CacheTags.ACADEMIC, CacheTags.classroom(classroomId)];

  const [roster, invitations] = await Promise.all([
    cached(`roster:${classroomId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
      classroomService.getClassroomRoster(classroomId, user),
    ),
    canManage
      ? cached(`invitations:${classroomId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
          invitationService.listPendingInvitations(classroomId, user),
        )
      : Promise.resolve([]),
  ]);

  res.json({ roster, invitations });
});

/**
 * The classroom's cover banner. Visibility follows the same membership /
 * archived / admin rules as every other classroom read.
 */
classroomRouter.get("/:classroomId/cover", async (req, res) => {
  const classroomId = classroomIdOf(req);
  await requireVisibleClassroom(classroomId, currentUser(req));

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { coverImageUrl: true },
  });
  if (!classroom?.coverImageUrl) {
    throw notFound("No cover image.");
  }

  // Seeded/legacy rows hold an external image URL rather than a storage key.
  if (/^https?:\/\//.test(classroom.coverImageUrl)) {
    res
      .set("Cache-Control", REPLACEABLE_IMAGE_CACHE_CONTROL)
      .redirect(302, classroom.coverImageUrl);
    return;
  }

  await sendStoredFile(req, res, {
    storageKey: classroom.coverImageUrl,
    contentType: getImageMimeType(classroom.coverImageUrl),
    cacheControl: REPLACEABLE_IMAGE_CACHE_CONTROL,
  });
});

// ---- Mutations --------------------------------------------------------------

classroomRouter.post("/", requireTeacherOrAdmin, multipart, async (req, res) => {
  const user = currentUser(req);
  const input = parseInput(createClassroomSchema, req.body);
  const coverImage = extractUploadedFiles(req, "coverImage")[0];
  const classroom = await classroomService.createClassroom(user.id, input, coverImage);
  invalidateClassroom(classroom.id);
  res.status(201).json({ status: "success", data: classroom });
});

classroomRouter.post("/join", async (req, res) => {
  const user = currentUser(req);
  const { code } = parseInput(joinClassroomSchema, req.body);
  const classroom = await classroomService.joinClassroomByCode(user, code);
  invalidateClassroom(classroom.id);
  res.json({ status: "success", data: classroom });
});

classroomRouter.patch("/:classroomId", requireTeacherOrAdmin, multipart, async (req, res) => {
  const user = currentUser(req);
  const { classroomId, ...data } = parseInput(updateClassroomSchema, {
    ...req.body,
    classroomId: req.params.classroomId,
  });
  const coverImage = extractUploadedFiles(req, "coverImage")[0];
  const removeCoverImage = req.body?.removeCoverImage === "true";
  const classroom = await classroomService.updateClassroom(
    classroomId,
    user,
    data,
    coverImage,
    removeCoverImage,
  );
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: classroom });
});

classroomRouter.post("/:classroomId/archive", requireTeacherOrAdmin, async (req, res) => {
  const classroomId = classroomIdOf(req);
  await classroomService.archiveClassroom(classroomId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classroomRouter.post("/:classroomId/restore", requireTeacherOrAdmin, async (req, res) => {
  const classroomId = classroomIdOf(req);
  await classroomService.restoreClassroom(classroomId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classroomRouter.post("/:classroomId/leave", async (req, res) => {
  const classroomId = classroomIdOf(req);
  await classroomService.leaveClassroom(currentUser(req).id, classroomId);
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classroomRouter.delete("/:classroomId/members/:userId", async (req, res) => {
  const { classroomId, userId } = parseParams(removeMemberSchema, req.params, "Invalid member.");
  await classroomService.removeMember(classroomId, userId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classroomRouter.patch("/:classroomId/members/:userId", async (req, res) => {
  const { classroomId, userId, role } = parseParams(
    changeMemberRoleSchema,
    { ...req.params, role: req.body?.role },
    "Invalid role change.",
  );
  await classroomService.changeMemberRole(classroomId, userId, role, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classroomRouter.post("/:classroomId/invitations", async (req, res) => {
  const { classroomId, email } = parseInput(inviteMemberSchema, {
    ...req.body,
    classroomId: req.params.classroomId,
  });
  const invitation = await invitationService.inviteMember(classroomId, currentUser(req), email);
  invalidateClassroom(classroomId);
  res.status(201).json({ status: "success", data: invitation });
});

classroomRouter.delete("/:classroomId/invitations/:invitationId", async (req, res) => {
  const { classroomId, invitationId } = parseParams(
    cancelInvitationSchema,
    req.params,
    "Invalid invitation.",
  );
  await invitationService.cancelInvitation(classroomId, invitationId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});
