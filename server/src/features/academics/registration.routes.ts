import { Router } from "express";

import { parseInput } from "@/http/validate";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { currentUser, requireAdmin, requireRole } from "@/middleware/auth";
import { UserRole } from "@/generated/prisma/enums";

import { done, intParam, parseInputAsync } from "./lib/http";
import type { Semester } from "./lib/terms";
import * as offerings from "./services/offering-service";
import * as registrations from "./services/registration-service";
import * as studentRegistration from "./services/student-registration-service";
import * as summary from "./services/summary-service";

/**
 * Registration periods (admin), the current term (everyone) and a student's
 * own registration. Self-service routes live under /my/... so they never
 * collide with the admin-only collections.
 */
export const registrationRouter = Router();

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);
const label = (r: { semester: string; year: number }) => `${registrations.semesterLabel(r.semester)} ${r.year}`;

// ---- Every role -----------------------------------------------------------------------

registrationRouter.get("/registrations/current", async (_req, res) => {
  res.json(await read("registrations:current", registrations.currentPeriods));
});

// ---- Admin ----------------------------------------------------------------------------

const admin = Router();
admin.use(requireAdmin);

admin.get("/", async (_req, res) => {
  res.json({ registrations: await read("registrations", registrations.listRegistrations) });
});

admin.post("/", async (req, res) => {
  const registration = await registrations.startRegistration(parseInput(registrations.startRegistrationSchema, req.body));
  // Opening registration sets the semester up: every running batch gets its diploma's courses.
  let offered: string;
  try {
    const term = { semester: registration.semester as Semester, year: registration.year };
    offered = (await offerings.offerTermDiplomas(term, currentUser(req).id)).message;
  } catch (error) {
    console.error("[registration] offering the term's diplomas failed", error);
    offered = "Courses couldn't be offered automatically: use \"Offer this term's diplomas\" on the Offer courses page.";
  }
  invalidateUniversity();
  done(res, { registration, message: `Registration started for ${label(registration)}. ${offered}` }, 201);
});

admin.post("/:id/end", async (req, res) => {
  const registration = await registrations.endRegistration(intParam(req, "id", "registration ID"));
  invalidateUniversity();
  done(res, { registration, message: `Registration for ${label(registration)} ended.` });
});

admin.post("/:id/end-semester", async (req, res) => {
  const registration = await registrations.endSemester(intParam(req, "id", "registration ID"));
  invalidateUniversity();
  done(res, { registration, message: `The ${label(registration)} semester has ended.` });
});

admin.delete("/:id", async (req, res) => {
  const registration = await registrations.deleteRegistration(intParam(req, "id", "registration ID"));
  invalidateUniversity();
  done(res, { message: `Registration for ${label(registration)} deleted.` });
});

admin.put("/:id/period", async (req, res) => {
  const registration = await registrations.setSemesterPeriod(
    intParam(req, "id", "registration ID"),
    parseInput(registrations.semesterPeriodSchema, req.body),
  );
  invalidateUniversity();
  done(res, { registration, message: `Semester period for ${label(registration)} updated.` });
});

admin.put("/:id/limits", async (req, res) => {
  const input = await parseInputAsync(registrations.batchLimitSchema, req.body);
  const limit = await registrations.setBatchLimit(intParam(req, "id", "registration ID"), input);
  invalidateUniversity();
  done(res, { limit, message: `Credit limit for batch ${input.batch} set to ${input.creditLimit}.` });
});

admin.delete("/:id/limits/:batch", async (req, res) => {
  const batch = String(req.params.batch);
  await registrations.deleteBatchLimit(intParam(req, "id", "registration ID"), batch);
  invalidateUniversity();
  done(res, { message: `Credit limit override for batch ${batch} removed.` });
});

registrationRouter.use("/registrations", admin);

// ---- Student self-service -------------------------------------------------------------

const student = requireRole(UserRole.STUDENT);

registrationRouter.get("/my/registration", student, async (req, res) => {
  // Not cached: it may offer courses (self-heal) and must reflect the latest registrations.
  res.json(await studentRegistration.getMyRegistration(currentUser(req).id));
});

registrationRouter.post("/my/registration", student, async (req, res) => {
  const result = await studentRegistration.registerCourse(
    currentUser(req).id,
    parseInput(studentRegistration.registerSchema, req.body),
  );
  invalidateUniversity();
  done(res, result, 201);
});

registrationRouter.get("/my/courses", student, async (req, res) => {
  const userId = currentUser(req).id;
  res.json(await read(`my-courses:${userId}`, () => studentRegistration.getMyCourses(userId)));
});

// ---- Dashboard summary (every role) ----------------------------------------------------

registrationRouter.get("/university/summary", async (req, res) => {
  const user = currentUser(req);
  const key = `university-summary:${user.role === "ADMIN" ? "admin" : user.id}`;
  res.json(
    await read<unknown>(key, () =>
      user.role === "ADMIN"
        ? summary.adminSummary()
        : user.role === "TEACHER"
          ? summary.teacherSummary(user.id)
          : summary.studentSummary(user.id),
    ),
  );
});
