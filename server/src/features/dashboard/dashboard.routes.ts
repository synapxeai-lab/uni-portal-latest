import { Router } from "express";

import { currentUser, requireTeacherOrAdmin } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl } from "@/lib/cache/tags";
import { UserRole } from "@/generated/prisma/enums";
import {
  listActiveClassroomsForUser,
  listUserClassrooms,
} from "@/features/classroom/services/classroom-service";
import { parseReviewFilters, type RawSearchParams } from "@/features/review/lib/review-params";
import * as reviewService from "@/features/review/services/review-service";
import * as todoService from "@/features/todo/services/todo-service";

import * as dashboardService from "./services/dashboard-service";

/**
 * Cross-classroom aggregate pages: Dashboard, To-do and To review. All are
 * cached briefly (they depend on the clock - due soon, overdue, today) and
 * tagged AGGREGATES, which every classroom-level mutation invalidates.
 */
export const dashboardRouter = Router();

const aggregateTags = [CacheTags.ACADEMIC, CacheTags.AGGREGATES];

/** Home: the platform-wide view for admins, the teaching view for teachers, the student view otherwise. */
dashboardRouter.get("/dashboard", async (req, res) => {
  const user = currentUser(req);

  if (user.role === UserRole.ADMIN) {
    const data = await cached(
      "dashboard:admin",
      { ttl: CacheTtl.LIVE, tags: [...aggregateTags, CacheTags.ADMIN] },
      () => dashboardService.getAdminDashboard(),
    );
    res.json({ role: user.role, data });
    return;
  }

  if (user.role === UserRole.TEACHER) {
    const data = await cached(
      `dashboard:teacher:${user.id}`,
      { ttl: CacheTtl.LIVE, tags: aggregateTags },
      () => dashboardService.getTeacherDashboard(user),
    );
    res.json({ role: user.role, data });
    return;
  }

  const [data, classrooms] = await Promise.all([
    cached(`dashboard:student:${user.id}`, { ttl: CacheTtl.LIVE, tags: aggregateTags }, () =>
      dashboardService.getStudentDashboard(user),
    ),
    cached(
      `classrooms:${user.id}`,
      { ttl: CacheTtl.LIVE, tags: [...aggregateTags, CacheTags.user(user.id)] },
      () => listUserClassrooms(user.id),
    ),
  ]);
  res.json({ role: user.role, data, classrooms });
});

/** Student to-do board, optionally narrowed to one class, plus the class filter options. */
dashboardRouter.get("/todo", async (req, res) => {
  const user = currentUser(req);
  const rawClassroomId =
    typeof req.query.classroomId === "string" ? req.query.classroomId.trim() : "";
  const classroomId = rawClassroomId || undefined;

  const [items, classrooms] = await Promise.all([
    cached(
      `todo:${user.id}:${classroomId ?? "all"}`,
      { ttl: CacheTtl.LIVE, tags: aggregateTags },
      () => todoService.getStudentTodoItems(user, { classroomId }),
    ),
    cached(`todo-classrooms:${user.id}`, { ttl: CacheTtl.LIVE, tags: aggregateTags }, () =>
      listActiveClassroomsForUser(user.id),
    ),
  ]);

  res.json({ items, classrooms });
});

/** Teacher review queue - filters, sort and page come from the query string. */
dashboardRouter.get("/review", requireTeacherOrAdmin, async (req, res) => {
  const user = currentUser(req);
  const filters = parseReviewFilters(req.query as RawSearchParams);
  const result = await cached(
    `review:${user.id}:${JSON.stringify(filters)}`,
    { ttl: CacheTtl.LIVE, tags: aggregateTags },
    () => reviewService.getTeacherReviewQueue(user, filters),
  );
  res.json(result);
});
