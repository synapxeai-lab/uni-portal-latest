import { Router } from "express";
import { z } from "zod";

import { parseInput } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateAdmin, invalidateUniversity } from "@/lib/cache/tags";
import { requireAdmin } from "@/middleware/auth";

import { done, intParam, parseInputAsync, strQuery } from "./lib/http";
import * as people from "./services/people-service";

/**
 * Teachers and students (admin). Each profile has a login, created or linked
 * when the profile is added. Mounted at /api behind requireAuth.
 */
export const peopleRouter = Router();
peopleRouter.use(["/teachers", "/students", "/sections/:id/students"], requireAdmin);

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);

/** Profile changes show on the Users page too. */
function invalidatePeople() {
  invalidateUniversity();
  invalidateAdmin();
}

// ---- Teachers -------------------------------------------------------------------------

peopleRouter.get("/teachers", async (req, res) => {
  const search = strQuery(req, "search");
  res.json({ teachers: await read(`teachers:${search ?? ""}`, () => people.listTeachers(search)) });
});

peopleRouter.get("/teachers/:id", async (req, res) => {
  const id = intParam(req, "id", "teacher ID");
  res.json({ teacher: await read(`teacher:${id}`, () => people.getTeacher(id)) });
});

peopleRouter.post("/teachers", async (req, res) => {
  const result = await people.createTeacher(await parseInputAsync(people.createTeacherSchema, req.body));
  invalidatePeople();
  done(res, { ...result, message: result.login ? "Teacher added and login created." : "Teacher added." }, 201);
});

peopleRouter.put("/teachers/:id", async (req, res) => {
  const teacher = await people.updateTeacher(
    intParam(req, "id", "teacher ID"),
    await parseInputAsync(people.updateTeacherSchema, req.body),
  );
  invalidatePeople();
  done(res, { teacher, message: "Teacher updated." });
});

peopleRouter.delete("/teachers/:id", async (req, res) => {
  await people.deleteTeacher(intParam(req, "id", "teacher ID"));
  invalidatePeople();
  done(res, { message: "Teacher deleted and their login archived." });
});

// ---- Students -------------------------------------------------------------------------

peopleRouter.get("/students", async (req, res) => {
  const params = {
    search: strQuery(req, "search"),
    programme: strQuery(req, "programme"),
    batch: strQuery(req, "batch"),
  };
  res.json({ students: await read(`students:${JSON.stringify(params)}`, () => people.listStudents(params)) });
});

peopleRouter.get("/students/:id", async (req, res) => {
  const id = intParam(req, "id", "student ID");
  res.json(await read(`student:${id}`, () => people.getStudent(id)));
});

peopleRouter.post("/students", async (req, res) => {
  const result = await people.createStudent(await parseInputAsync(people.createStudentSchema, req.body));
  invalidatePeople();
  done(res, { ...result, message: result.login ? "Student added and login created." : "Student added." }, 201);
});

peopleRouter.put("/students/:id", async (req, res) => {
  const student = await people.updateStudent(
    intParam(req, "id", "student ID"),
    await parseInputAsync(people.updateStudentSchema, req.body),
  );
  invalidatePeople();
  done(res, { student, message: "Student updated." });
});

peopleRouter.delete("/students/:id", async (req, res) => {
  await people.deleteStudent(intParam(req, "id", "student ID"));
  invalidatePeople();
  done(res, { message: "Student deleted and their login archived." });
});

// ---- Section membership -----------------------------------------------------------------

peopleRouter.post("/sections/:id/students", async (req, res) => {
  const { studentId } = parseInput(z.object({ studentId: z.number().int("Student is required") }), req.body);
  await people.addStudentToSection(intParam(req, "id", "section ID"), studentId);
  invalidateUniversity();
  done(res, { message: "Student added to the section." });
});

peopleRouter.delete("/sections/:id/students/:studentId", async (req, res) => {
  await people.removeStudentFromSection(intParam(req, "id", "section ID"), intParam(req, "studentId", "student ID"));
  invalidateUniversity();
  done(res, { message: "Student removed from the section." });
});
