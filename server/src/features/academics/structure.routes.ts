import { Router } from "express";

import { parseInput } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { requireAdmin } from "@/middleware/auth";

import { getBatchDetails } from "./lib/batches";
import { done, intParam, intQuery, parseInputAsync, strQuery } from "./lib/http";
import { listCategories } from "./lib/programme-categories";
import * as batchService from "./services/batch-service";
import * as courseService from "./services/course-service";
import * as departmentService from "./services/department-service";
import * as programmeService from "./services/programme-service";
import { syncChallansForCourses, syncChallansForDiploma } from "./services/fee-service";
import * as sectionService from "./services/section-service";

/**
 * Academic structure: main programmes, diplomas, courses, batches and
 * sections. Mounted at /api behind requireAuth. Programmes and batches are
 * readable by every signed-in user (pages show their names); everything else
 * is admin-only.
 */
export const structureRouter = Router();

const tags = [CacheTags.UNIVERSITY];
const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags }, load);

// ---- Main programmes ----------------------------------------------------------------

structureRouter.get("/programme-categories", async (_req, res) => {
  res.json({ categories: await read("programme-categories", listCategories) });
});

structureRouter.post("/programme-categories", requireAdmin, async (req, res) => {
  const category = await programmeService.createProgramme(
    parseInput(programmeService.createProgrammeSchema, req.body),
  );
  invalidateUniversity();
  done(res, { category, message: "Main programme created." }, 201);
});

structureRouter.put("/programme-categories/:id", requireAdmin, async (req, res) => {
  const category = await programmeService.updateProgramme(
    intParam(req, "id", "programme ID"),
    parseInput(programmeService.updateProgrammeSchema, req.body),
  );
  invalidateUniversity();
  done(res, { category, message: "Main programme updated." });
});

structureRouter.delete("/programme-categories/:id", requireAdmin, async (req, res) => {
  await programmeService.deleteProgramme(intParam(req, "id", "programme ID"));
  invalidateUniversity();
  done(res, { message: "Main programme deleted." });
});

// ---- Batches ------------------------------------------------------------------------

structureRouter.get("/batches", async (_req, res) => {
  const details = await read("batches", getBatchDetails);
  res.json({ batches: details.map((batch) => batch.name), details });
});

structureRouter.post("/batches", requireAdmin, async (req, res) => {
  const result = await batchService.createBatch(parseInput(batchService.batchSchema, req.body));
  invalidateUniversity();
  done(res, result, 201);
});

structureRouter.put("/batches/:name", requireAdmin, async (req, res) => {
  const result = await batchService.updateBatch(
    String(req.params.name),
    parseInput(batchService.batchSchema, req.body),
  );
  invalidateUniversity();
  done(res, result);
});

structureRouter.delete("/batches/:name", requireAdmin, async (req, res) => {
  const result = await batchService.deleteBatch(String(req.params.name));
  invalidateUniversity();
  done(res, result);
});

// ---- Diplomas (departments) ---------------------------------------------------------

structureRouter.get("/departments", requireAdmin, async (req, res) => {
  const params = { search: strQuery(req, "search"), category: strQuery(req, "category") };
  res.json({
    departments: await read(`departments:${JSON.stringify(params)}`, () =>
      departmentService.listDepartments(params),
    ),
  });
});

structureRouter.get("/departments/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id", "diploma ID");
  res.json({ department: await read(`department:${id}`, () => departmentService.getDepartment(id)) });
});

structureRouter.post("/departments", requireAdmin, async (req, res) => {
  const department = await departmentService.createDepartment(
    await parseInputAsync(departmentService.createDepartmentSchema, req.body),
  );
  invalidateUniversity();
  done(res, { department, message: "Diploma created." }, 201);
});

structureRouter.put("/departments/:id", requireAdmin, async (req, res) => {
  const department = await departmentService.updateDepartment(
    intParam(req, "id", "diploma ID"),
    await parseInputAsync(departmentService.updateDepartmentSchema, req.body),
  );
  // A new whole-diploma discount changes what its students owe.
  await syncChallansForDiploma(department.id);
  invalidateUniversity();
  done(res, { department, message: "Diploma updated." });
});

structureRouter.delete("/departments/:id", requireAdmin, async (req, res) => {
  await departmentService.deleteDepartment(intParam(req, "id", "diploma ID"));
  invalidateUniversity();
  done(res, { message: "Diploma deleted." });
});

// ---- Courses ------------------------------------------------------------------------

structureRouter.get("/courses", requireAdmin, async (req, res) => {
  const params = {
    search: strQuery(req, "search"),
    departmentId: intQuery(req, "departmentId"),
    category: strQuery(req, "category"),
    semester: intQuery(req, "semester"),
    status: strQuery(req, "status"),
  };
  res.json({
    courses: await read(`courses:${JSON.stringify(params)}`, () => courseService.listCourses(params)),
  });
});

structureRouter.get("/courses/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id", "course ID");
  res.json({ course: await read(`course:${id}`, () => courseService.getCourse(id)) });
});

structureRouter.post("/courses", requireAdmin, async (req, res) => {
  const courses = await courseService.createCourse(parseInput(courseService.createCourseSchema, req.body));
  invalidateUniversity();
  done(
    res,
    {
      course: courses[0],
      courses,
      message:
        courses.length === 1 ? "Course created." : `Course added to ${courses.length} diplomas.`,
    },
    201,
  );
});

structureRouter.post("/courses/:id/copy", requireAdmin, async (req, res) => {
  const { departmentId } = parseInput(courseService.copyCourseSchema, req.body);
  const { course, department } = await courseService.copyCourse(
    intParam(req, "id", "course ID"),
    departmentId,
  );
  invalidateUniversity();
  done(res, { course, message: `${course.name} added to ${department.name}.` }, 201);
});

structureRouter.put("/courses/:id", requireAdmin, async (req, res) => {
  const course = await courseService.updateCourse(
    intParam(req, "id", "course ID"),
    parseInput(courseService.updateCourseSchema, req.body),
  );
  await syncChallansForCourses([course.id]);
  invalidateUniversity();
  done(res, { course, message: "Course updated." });
});

structureRouter.delete("/courses/:id", requireAdmin, async (req, res) => {
  await courseService.deleteCourse(intParam(req, "id", "course ID"));
  invalidateUniversity();
  done(res, { message: "Course deleted." });
});

structureRouter.post("/courses/:id/fees", requireAdmin, async (req, res) => {
  const input = parseInput(courseService.extraFeeSchema, req.body);
  const course = await courseService.addExtraFee(intParam(req, "id", "course ID"), input);
  await syncChallansForCourses([course.id]);
  invalidateUniversity();
  done(res, { course, message: `${input.name} added.` }, 201);
});

structureRouter.put("/courses/:id/fees/:feeId", requireAdmin, async (req, res) => {
  const input = parseInput(courseService.extraFeeSchema, req.body);
  const course = await courseService.updateExtraFee(
    intParam(req, "id", "course ID"),
    intParam(req, "feeId", "fee ID"),
    input,
  );
  await syncChallansForCourses([course.id]);
  invalidateUniversity();
  done(res, { course, message: `${input.name} updated.` });
});

structureRouter.delete("/courses/:id/fees/:feeId", requireAdmin, async (req, res) => {
  const { course, fee } = await courseService.deleteExtraFee(
    intParam(req, "id", "course ID"),
    intParam(req, "feeId", "fee ID"),
  );
  await syncChallansForCourses([course.id]);
  invalidateUniversity();
  done(res, { course, message: `${fee.name} removed.` });
});

// ---- Sections -----------------------------------------------------------------------

structureRouter.get("/sections/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id", "section ID");
  res.json({ section: await read(`section:${id}`, () => sectionService.getSection(id)) });
});

structureRouter.post("/sections", requireAdmin, async (req, res) => {
  const section = await sectionService.createSection(
    await parseInputAsync(sectionService.createSectionSchema, req.body),
  );
  invalidateUniversity();
  done(res, { section, message: `Section ${section.label} added.` }, 201);
});

structureRouter.delete("/sections/:id", requireAdmin, async (req, res) => {
  const section = await sectionService.deleteSection(intParam(req, "id", "section ID"));
  invalidateUniversity();
  done(res, { message: `Section ${section.label} deleted.` });
});

