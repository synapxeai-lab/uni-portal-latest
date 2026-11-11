import { Router } from "express";

import { parseInput } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { currentUser, requireAdmin, requireRole, requireTeacherOrAdmin } from "@/middleware/auth";
import { UserRole } from "@/generated/prisma/enums";

import { done, intParam } from "./lib/http";
import * as marks from "./services/marks-service";
import * as results from "./services/student-results-service";

/**
 * Marks, grading and grades. Teachers act on the offerings they teach and
 * admins on every one (checked per offering); students read their own.
 */
export const marksRouter = Router();

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);

// ---- Marks sheet (teacher of the offering, or admin) ----------------------------------

marksRouter.get("/marks/:sectionId/:courseId", requireTeacherOrAdmin, async (req, res) => {
  const sectionId = intParam(req, "sectionId", "section ID");
  const courseId = intParam(req, "courseId", "course ID");
  // Not cached: it may create the scheme's categories for this section first.
  res.json(await marks.getMarksSheet(currentUser(req), sectionId, courseId));
});

marksRouter.post("/marks/categories/:categoryId/assessments", requireTeacherOrAdmin, async (req, res) => {
  const { totalMarks } = parseInput(marks.totalMarksSchema, req.body);
  const assessment = await marks.createAssessment(currentUser(req), intParam(req, "categoryId", "section ID"), totalMarks);
  invalidateUniversity();
  done(res, { assessment, message: `${assessment.title} created.` }, 201);
});

marksRouter.delete("/marks/categories/:categoryId", requireTeacherOrAdmin, async (req, res) => {
  await marks.deleteCategory(currentUser(req), intParam(req, "categoryId", "section ID"));
  invalidateUniversity();
  done(res, { message: "Assessment section deleted." });
});

marksRouter.put("/marks/assessments/:assessmentId", requireTeacherOrAdmin, async (req, res) => {
  const { totalMarks } = parseInput(marks.totalMarksSchema, req.body);
  await marks.updateAssessment(currentUser(req), intParam(req, "assessmentId", "assessment ID"), totalMarks);
  invalidateUniversity();
  done(res, { message: "Total marks updated." });
});

marksRouter.delete("/marks/assessments/:assessmentId", requireTeacherOrAdmin, async (req, res) => {
  const assessment = await marks.deleteAssessment(currentUser(req), intParam(req, "assessmentId", "assessment ID"));
  invalidateUniversity();
  done(res, { message: `${assessment.title} deleted.` });
});

marksRouter.put("/marks/assessments/:assessmentId/marks", requireTeacherOrAdmin, async (req, res) => {
  const { records } = parseInput(marks.saveMarksSchema, req.body);
  const result = await marks.saveMarks(currentUser(req), intParam(req, "assessmentId", "assessment ID"), records);
  invalidateUniversity();
  done(res, { ...result, message: "Marks saved." });
});

marksRouter.put("/marks/:sectionId/:courseId/grading", requireTeacherOrAdmin, async (req, res) => {
  const { grades } = parseInput(marks.gradingSchema, req.body);
  await marks.saveGrading(currentUser(req), intParam(req, "sectionId", "section ID"), intParam(req, "courseId", "course ID"), grades);
  invalidateUniversity();
  done(res, { message: "Grading criteria saved." });
});

marksRouter.put("/marks/enrollments/:enrollmentId/percentage", requireAdmin, async (req, res) => {
  const { percentage } = parseInput(marks.percentageOverrideSchema, req.body);
  await marks.setPercentageOverride(currentUser(req), intParam(req, "enrollmentId", "registration ID"), percentage);
  invalidateUniversity();
  done(res, {
    message: percentage === null ? "Adjustment removed - the percentage follows the marks again." : "Course percentage updated.",
  });
});

marksRouter.put("/marks/enrollments/:enrollmentId/grade", requireTeacherOrAdmin, async (req, res) => {
  const { grade } = parseInput(marks.gradeOverrideSchema, req.body);
  const summary = await marks.setGradeOverride(currentUser(req), intParam(req, "enrollmentId", "registration ID"), grade);
  invalidateUniversity();
  done(res, { summary, message: grade === null ? "Grade reset - it follows the grading criteria again." : `Grade changed to ${grade}.` });
});

// ---- Course assessment scheme (admin) --------------------------------------------------

marksRouter.put("/courses/:id/assessment-scheme", requireAdmin, async (req, res) => {
  await marks.saveScheme(intParam(req, "id", "course ID"), parseInput(marks.schemeSchema, req.body));
  invalidateUniversity();
  done(res, { message: "Assessment scheme saved." });
});

// ---- Grades: generate and release (teacher: own offerings; admin: all) -----------------

marksRouter.get("/grades", requireTeacherOrAdmin, async (req, res) => {
  const viewer = currentUser(req);
  res.json(await read(`grades:${viewer.role === "ADMIN" ? "all" : viewer.id}`, () => marks.gradesOverview(viewer)));
});

marksRouter.post("/grades/generate", requireTeacherOrAdmin, async (req, res) => {
  const result = await marks.generateGrades(currentUser(req), parseInput(marks.generateSchema, req.body));
  invalidateUniversity();
  done(res, result);
});

marksRouter.put("/grades/releases/:courseId", requireTeacherOrAdmin, async (req, res) => {
  const { visibleFrom } = parseInput(marks.releaseDateSchema, req.body);
  await marks.updateRelease(currentUser(req), intParam(req, "courseId", "course ID"), visibleFrom);
  invalidateUniversity();
  done(res, { message: "Visibility date updated." });
});

marksRouter.delete("/grades/releases/:courseId", requireTeacherOrAdmin, async (req, res) => {
  const count = await marks.deleteRelease(currentUser(req), intParam(req, "courseId", "course ID"));
  invalidateUniversity();
  done(res, { message: `Grades unpublished for ${count} student${count === 1 ? "" : "s"}.` });
});

// ---- Students --------------------------------------------------------------------------

const student = requireRole(UserRole.STUDENT);

marksRouter.get("/my/marks", student, async (req, res) => {
  const userId = currentUser(req).id;
  res.json(await read(`my-marks:${userId}`, () => results.getMyMarks(userId)));
});

marksRouter.get("/my/marks/:enrollmentId", student, async (req, res) => {
  const userId = currentUser(req).id;
  const enrollmentId = intParam(req, "enrollmentId", "course");
  res.json(await read(`my-marks:${userId}:${enrollmentId}`, () => results.getMyCourseMarks(userId, enrollmentId)));
});

marksRouter.get("/my/transcript", student, async (req, res) => {
  const userId = currentUser(req).id;
  res.json(await read(`my-transcript:${userId}`, () => results.getMyTranscript(userId)));
});
