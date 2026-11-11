import { Router } from "express";

import { parseInput, parseParams } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { currentUser, requireAdmin, requireRole } from "@/middleware/auth";
import { UserRole } from "@/generated/prisma/enums";

import { done, intParam, strQuery } from "./lib/http";
import { assertTeachesOffering } from "./lib/self";
import * as attendance from "./services/attendance-service";

/**
 * Attendance per offering (course in a section): taken by its teacher or an
 * admin, shown to students for their own courses.
 */
export const attendanceRouter = Router();

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);

const offeringParams = (req: Parameters<typeof intParam>[0]) => ({
  sectionId: intParam(req, "sectionId", "section ID"),
  courseId: intParam(req, "courseId", "course ID"),
});

attendanceRouter.get("/attendance", requireAdmin, async (req, res) => {
  const category = strQuery(req, "category");
  res.json({ offerings: await read(`attendance:overview:${category ?? ""}`, () => attendance.attendanceOverview({ category })) });
});

attendanceRouter.get("/attendance/:sectionId/:courseId", async (req, res) => {
  const { sectionId, courseId } = offeringParams(req);
  const offering = await assertTeachesOffering(currentUser(req), sectionId, courseId);
  const today = new Date().toISOString().slice(0, 10);
  const date = parseParams(attendance.dateOnly, strQuery(req, "date") ?? today, "A valid date is required.");
  const data = await read(`attendance:${sectionId}:${courseId}:${date.toISOString()}`, () =>
    attendance.getAttendance(courseId, sectionId, date),
  );
  res.json({ offering, ...data });
});

attendanceRouter.post("/attendance/:sectionId/:courseId", async (req, res) => {
  const { sectionId, courseId } = offeringParams(req);
  await assertTeachesOffering(currentUser(req), sectionId, courseId);
  const result = await attendance.saveAttendance(courseId, sectionId, parseInput(attendance.saveAttendanceSchema, req.body));
  invalidateUniversity();
  done(res, { ...result, message: `Attendance saved for ${result.saved} student(s).` });
});

attendanceRouter.get("/my/attendance", requireRole(UserRole.STUDENT), async (req, res) => {
  const userId = currentUser(req).id;
  res.json(await read(`my-attendance:${userId}`, () => attendance.getMyAttendance(userId)));
});
