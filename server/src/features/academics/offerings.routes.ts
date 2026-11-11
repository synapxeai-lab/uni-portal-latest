import { Router } from "express";

import { parseInput } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { currentUser, requireAdmin } from "@/middleware/auth";

import { done, intParam, intQuery, strQuery } from "./lib/http";
import { syncAllOfferingClassrooms } from "./lib/offering-classrooms";
import * as offerings from "./services/offering-service";

/**
 * Course offerings and teacher assignment (admin). Offering a course to a
 * section creates its classroom; assigning a teacher makes them its owner.
 */
export const offeringsRouter = Router();
offeringsRouter.use(["/offerings", "/assignments"], requireAdmin);

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);

offeringsRouter.get("/offerings", async (req, res) => {
  const category = strQuery(req, "category");
  res.json(await read(`offerings:${category ?? ""}`, () => offerings.offeringOverview({ category })));
});

offeringsRouter.get("/offerings/:departmentId/:batch", async (req, res) => {
  const departmentId = intParam(req, "departmentId", "diploma ID");
  const batch = String(req.params.batch);
  res.json(await read(`offerings:${departmentId}:${batch}`, () => offerings.batchOfferings(departmentId, batch)));
});

offeringsRouter.post("/offerings", async (req, res) => {
  const result = await offerings.offerCourse(parseInput(offerings.offerSchema, req.body), currentUser(req).id);
  invalidateUniversity();
  done(res, result);
});

offeringsRouter.post("/offerings/remove", async (req, res) => {
  const result = await offerings.unofferCourse(parseInput(offerings.offerSchema, req.body));
  invalidateUniversity();
  done(res, result);
});

/** Offers every batch its current diploma's courses (the portal did this on page load). */
offeringsRouter.post("/offerings/current", async (req, res) => {
  const result = await offerings.offerCurrentDiplomas(currentUser(req).id);
  invalidateUniversity();
  done(res, result);
});

/** Re-creates / re-syncs every offering's classroom (after an import, or to repair). */
offeringsRouter.post("/offerings/sync-classrooms", async (req, res) => {
  const ids = await syncAllOfferingClassrooms(currentUser(req).id);
  invalidateUniversity();
  done(res, { message: `${ids.length} classroom(s) in sync with their offerings.` });
});

offeringsRouter.get("/assignments", async (req, res) => {
  const params = { departmentId: intQuery(req, "departmentId"), category: strQuery(req, "category") };
  res.json({ courses: await read(`assignments:${JSON.stringify(params)}`, () => offerings.listAssignments(params)) });
});

offeringsRouter.put("/assignments/:sectionId/:courseId", async (req, res) => {
  const { teacherId } = parseInput(offerings.assignTeacherSchema, req.body);
  const result = await offerings.assignTeacher(
    intParam(req, "sectionId", "section ID"),
    intParam(req, "courseId", "course ID"),
    teacherId,
    currentUser(req).id,
  );
  invalidateUniversity();
  done(res, result);
});
