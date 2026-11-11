import { Router, type Request } from "express";
import { z } from "zod";

import { parseInput, parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateAllAcademic, invalidateUser } from "@/lib/cache/tags";
import { ClassroomStatus, UserRole, UserStatus } from "@/generated/prisma/enums";

import * as auditLogService from "./audit-logs/services/audit-log-service";
import * as classroomAdminService from "./classrooms/services/classroom-admin-service";
import type { ClassroomSortField, ListClassroomsParams } from "./classrooms/types";
import {
  assignTeacherSchema,
  transferOwnershipSchema,
} from "./classrooms/validation/classroom-admin-schema";
import * as userService from "./users/services/user-service";
import type { ListUsersParams, UserSortField } from "./users/types";
import {
  createUserSchema,
  setUserStatusSchema,
  updateUserSchema,
} from "./users/validation/user-schema";

/** Admin console - mounted under /admin behind requireAdmin. */
export const adminRouter = Router();

const adminTags = [CacheTags.ADMIN];

function stringParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pageParam(req: Request): number {
  const page = Number(stringParam(req, "page") ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

/** "field:dir" sort param, e.g. "createdAt:asc". */
function sortParam<T extends string>(req: Request, fields: readonly T[]) {
  const [fieldRaw, dirRaw] = (stringParam(req, "sort") ?? "").split(":");
  return {
    sortField: fields.includes(fieldRaw as T) ? (fieldRaw as T) : undefined,
    sortDir: dirRaw === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

function userIdOf(req: Request): string {
  return parseParams(z.object({ userId: z.string().uuid() }), req.params, "Invalid user.").userId;
}

function classroomIdOf(req: Request): string {
  return parseParams(z.object({ classroomId: z.string().uuid() }), req.params, "Invalid classroom.")
    .classroomId;
}

// ---- Users --------------------------------------------------------------------------

const USER_SORT_FIELDS: UserSortField[] = ["name", "email", "role", "status", "createdAt"];

adminRouter.get("/users", async (req, res) => {
  const role = stringParam(req, "role");
  const status = stringParam(req, "status");
  const params: ListUsersParams = {
    search: stringParam(req, "q"),
    role: role && role in UserRole ? (role as UserRole) : undefined,
    status: status && status in UserStatus ? (status as UserStatus) : undefined,
    ...sortParam(req, USER_SORT_FIELDS),
    page: pageParam(req),
  };
  const page = await cached(
    `admin:users:${JSON.stringify(params)}`,
    { ttl: CacheTtl.LIVE, tags: adminTags },
    () => userService.listUsers(params),
  );
  res.json(page);
});

adminRouter.get("/users/:userId", async (req, res) => {
  res.set("Cache-Control", "no-store").json(await userService.getUserDetail(userIdOf(req)));
});

adminRouter.post("/users", async (req, res) => {
  const input = parseInput(createUserSchema, req.body);
  const result = await userService.createUser(input, currentUser(req));
  invalidateAllAcademic();
  res.status(201).json({ status: "success", data: result });
});

adminRouter.patch("/users/:userId", async (req, res) => {
  const { userId, ...data } = parseInput(updateUserSchema, {
    ...req.body,
    userId: req.params.userId,
  });
  const user = await userService.updateUser(userId, data, currentUser(req));
  invalidateAllAcademic();
  // Role or name changes must reach that user's live session immediately.
  invalidateUser(userId);
  res.json({ status: "success", data: user });
});

adminRouter.post("/users/:userId/status", async (req, res) => {
  const { userId, status } = parseParams(
    setUserStatusSchema,
    { userId: req.params.userId, status: req.body?.status },
    "Invalid status change.",
  );
  const user = await userService.setUserStatus(userId, status, currentUser(req));
  invalidateAllAcademic();
  // Suspending/deactivating ends their access on their very next request.
  invalidateUser(userId);
  res.json({ status: "success", data: user });
});

adminRouter.post("/users/:userId/reset-password", async (req, res) => {
  const userId = userIdOf(req);
  const result = await userService.resetPassword(userId, currentUser(req));
  invalidateAllAcademic();
  invalidateUser(userId);
  res.json({ status: "success", data: result });
});

adminRouter.get("/users/:userId/password", async (req, res) => {
  // Never cached: it is read on demand, one user at a time.
  res.json({ status: "success", data: await userService.viewPassword(userIdOf(req)) });
});

adminRouter.post("/users/:userId/force-password-change", async (req, res) => {
  const userId = userIdOf(req);
  await userService.forcePasswordChange(userId, currentUser(req));
  invalidateAllAcademic();
  invalidateUser(userId);
  res.json({ status: "success", data: undefined });
});

// ---- Classrooms -----------------------------------------------------------------------

const CLASSROOM_SORT_FIELDS: ClassroomSortField[] = ["title", "status", "createdAt", "memberCount"];

adminRouter.get("/classrooms", async (req, res) => {
  const status = stringParam(req, "status");
  const params: ListClassroomsParams = {
    search: stringParam(req, "q"),
    status: status && status in ClassroomStatus ? (status as ClassroomStatus) : undefined,
    ...sortParam(req, CLASSROOM_SORT_FIELDS),
    page: pageParam(req),
  };
  const page = await cached(
    `admin:classrooms:${JSON.stringify(params)}`,
    { ttl: CacheTtl.LIVE, tags: adminTags },
    () => classroomAdminService.listClassrooms(params),
  );
  res.json(page);
});

adminRouter.get("/classrooms/:classroomId", async (req, res) => {
  res
    .set("Cache-Control", "no-store")
    .json(await classroomAdminService.getClassroomDetail(classroomIdOf(req)));
});

adminRouter.post("/classrooms/:classroomId/archive", async (req, res) => {
  const classroom = await classroomAdminService.archiveClassroom(
    classroomIdOf(req),
    currentUser(req),
  );
  invalidateAllAcademic();
  res.json({ status: "success", data: classroom });
});

adminRouter.post("/classrooms/:classroomId/restore", async (req, res) => {
  const classroom = await classroomAdminService.restoreClassroom(classroomIdOf(req));
  invalidateAllAcademic();
  res.json({ status: "success", data: classroom });
});

adminRouter.delete("/classrooms/:classroomId", async (req, res) => {
  const classroom = await classroomAdminService.deleteClassroom(classroomIdOf(req));
  invalidateAllAcademic();
  res.json({ status: "success", data: classroom });
});

adminRouter.post("/classrooms/:classroomId/transfer", async (req, res) => {
  const input = parseInput(transferOwnershipSchema, {
    ...req.body,
    classroomId: req.params.classroomId,
  });
  const classroom = await classroomAdminService.transferOwnership(
    input.classroomId,
    input.newOwnerEmail,
  );
  invalidateAllAcademic();
  res.json({ status: "success", data: classroom });
});

adminRouter.post("/classrooms/:classroomId/teachers", async (req, res) => {
  const input = parseInput(assignTeacherSchema, {
    ...req.body,
    classroomId: req.params.classroomId,
  });
  const member = await classroomAdminService.assignTeacher(input.classroomId, input.teacherEmail);
  invalidateAllAcademic();
  res.json({ status: "success", data: member });
});

// ---- Audit logs ------------------------------------------------------------------------

adminRouter.get("/audit-logs", async (req, res) => {
  const params = {
    search: stringParam(req, "q"),
    eventLabel: stringParam(req, "event"),
    page: pageParam(req),
  };
  const page = await cached(
    `admin:audit:${JSON.stringify(params)}`,
    { ttl: CacheTtl.LIVE, tags: adminTags },
    () => auditLogService.listAuditLogs(params),
  );
  res.json(page);
});
