import { z } from "zod";

import type { Department, Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { getBatchYears } from "../lib/batches";
import { syncChallan } from "../lib/challans";
import { conflictError, notFoundError } from "../lib/http";
import { syncClassroomsFor } from "../lib/offering-classrooms";
import { getSelfStudent } from "../lib/self";
import { syncEnrolledSection } from "../lib/section-sync";
import {
  computeStudentSemester,
  diplomaForTerm,
  getProgrammeDiplomas,
  openRegistrationWhere,
} from "../lib/terms";
import { offerCourse, offerDiplomaToBatch } from "./offering-service";
import { DEFAULT_CREDIT_LIMIT } from "./registration-service";

export const registerSchema = z.object({
  courseId: z.number().int("Course is required"),
  sectionId: z.number().int("Section is required"),
});

const PENDING_GRADES_MESSAGE = "Previous grades are not yet uploaded.";
const SEMESTER_RANK: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

type Student = Awaited<ReturnType<typeof getSelfStudent>>;

const findActiveRegistration = (now = new Date()) =>
  prisma.registration.findFirst({ where: openRegistrationWhere(now), orderBy: { startDate: "desc" } });

/** Any earlier course still without a visible grade blocks new registrations. */
async function hasPendingGrades(studentId: number, registrationId: number, now = new Date()) {
  const pending = await prisma.enrollment.findFirst({
    where: {
      studentId,
      registrationId: { not: registrationId },
      OR: [{ publishedGrade: null }, { gradeVisibleFrom: null }, { gradeVisibleFrom: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(pending);
}

const visibleFailWhere = (now = new Date()) => ({ publishedGrade: "F", gradeVisibleFrom: { lte: now } });

/** Courses failed: a visible F, and every other attempt outside this registration is a visible F too. */
function failedCourseWhere(studentId: number, registrationId: number): Prisma.CourseWhereInput {
  const now = new Date();
  return {
    AND: [
      { enrollments: { some: { studentId, ...visibleFailWhere(now) } } },
      {
        enrollments: {
          none: {
            studentId,
            registrationId: { not: registrationId },
            OR: [
              { publishedGrade: null },
              { publishedGrade: { not: "F" } },
              { gradeVisibleFrom: null },
              { gradeVisibleFrom: { gt: now } },
            ],
          },
        },
      },
    ],
  };
}

/** Courses of earlier diplomas that are transcript gaps: never registered, or failed. */
function transcriptGapWhere(
  student: Student,
  diplomas: Department[],
  semester: number,
  registrationId: number,
): Prisma.CourseWhereInput & { departmentId: { in: number[] } } {
  return {
    departmentId: { in: diplomas.filter((d) => d.semester < semester).map((d) => d.id) },
    OR: [{ enrollments: { none: { studentId: student.id } } }, failedCourseWhere(student.id, registrationId)],
  };
}

const offeredInclude = (sectionWhere: Prisma.SectionWhereInput) =>
  ({
    department: true,
    sectionLinks: {
      where: { section: sectionWhere },
      include: { section: true, teacher: { select: { id: true, name: true } } },
    },
  }) satisfies Prisma.CourseInclude;

type OfferedCourse = Prisma.CourseGetPayload<{ include: ReturnType<typeof offeredInclude> }>;

/** Offers each missed/failed course to the student's batch in its own diploma, so gaps can be made up. */
async function offerMissedCourses(student: Student, diplomas: Department[], semester: number | null, registrationId: number) {
  if (!semester || semester < 2) {
    return;
  }
  const unoffered = await prisma.course.findMany({
    where: {
      ...transcriptGapWhere(student, diplomas, semester, registrationId),
      sectionLinks: { none: { section: { batch: student.batch } } },
    },
    select: { id: true, departmentId: true },
  });
  for (const course of unoffered) {
    await offerCourse({ departmentId: course.departmentId, courseId: course.id, batch: student.batch }, null);
  }
}

function findMissedCourses(student: Student, diplomas: Department[], semester: number, registrationId: number) {
  const where = transcriptGapWhere(student, diplomas, semester, registrationId);
  if (where.departmentId.in.length === 0) {
    return Promise.resolve([] as OfferedCourse[]);
  }
  return prisma.course.findMany({
    where: { ...where, sectionLinks: { some: { section: { batch: student.batch } } } },
    include: offeredInclude({ batch: student.batch }),
    orderBy: [{ department: { semester: "asc" } }, { code: "asc" }],
  });
}

/** No diploma this term: courses offered to the batch in the programme not taken yet (or failed). */
function findExtraOfferedCourses(student: Student, diplomas: Department[], registrationId: number) {
  const sectionWhere = { batch: student.batch, departmentId: { in: diplomas.map((d) => d.id) } };
  return prisma.course.findMany({
    where: {
      sectionLinks: { some: { section: sectionWhere } },
      OR: [
        { enrollments: { none: { studentId: student.id } } },
        { enrollments: { some: { studentId: student.id, registrationId } } },
        failedCourseWhere(student.id, registrationId),
      ],
    },
    include: offeredInclude(sectionWhere),
    orderBy: [{ department: { semester: "asc" } }, { code: "asc" }],
  });
}

async function creditLimitFor(registrationId: number, batch: string) {
  const override = await prisma.registrationLimit.findUnique({
    where: { registrationId_batch: { registrationId, batch } },
  });
  return override?.creditLimit ?? DEFAULT_CREDIT_LIMIT;
}

/**
 * Self-heal before showing registration: the student's section links, the
 * diploma's courses on offer to the batch, and missed courses offered again.
 * These are writes, so they run at most once a minute per student and period;
 * reloading the page within that minute is a pure read.
 */
const preparedAt = new Map<string, number>();
const PREPARE_TTL_MS = 60_000;

async function prepare(student: Student, diploma: Department | null, diplomas: Department[], semester: number | null, registrationId: number) {
  const key = `${student.id}:${registrationId}`;
  const last = preparedAt.get(key);
  if (last && Date.now() - last < PREPARE_TTL_MS) {
    return false;
  }
  await syncEnrolledSection(student.id);
  if (diploma) {
    await offerDiplomaToBatch(diploma.id, student.batch, null);
  }
  await offerMissedCourses(student, diplomas, semester, registrationId);
  preparedAt.set(key, Date.now());
  return true;
}

function toOffered(
  course: OfferedCourse,
  student: Student,
  enrolledByCourse: Map<number, { sectionId: number }>,
  preferredSectionIds: number[],
  missed: boolean,
  failedIds: Set<number>,
) {
  const enrollment = enrolledByCourse.get(course.id);
  const sections = course.sectionLinks.map((link) => ({
    id: link.section.id,
    label: link.section.label,
    teacher: link.teacher,
  }));
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    creditHours: course.creditHours,
    department: { id: course.department.id, code: course.department.code, name: course.department.name, semester: course.department.semester },
    sections,
    // The section named on the student's record, else their own section, else the first.
    defaultSectionId:
      sections.find((s) => s.label.toLowerCase() === student.section.toLowerCase())?.id ??
      sections.find((s) => preferredSectionIds.includes(s.id))?.id ??
      sections[0]?.id ??
      null,
    registered: Boolean(enrollment),
    registeredSectionId: enrollment?.sectionId ?? null,
    missed,
    failed: missed && failedIds.has(course.id),
    ...(missed ? { missedSemester: course.department.semester } : {}),
  };
}

/** The student's registration page: what they can register for this period. */
export async function getMyRegistration(userId: string) {
  let student = await getSelfStudent(userId);
  const registration = await findActiveRegistration();
  if (!registration) {
    return { registrationOpen: false, message: "Registration is not currently open.", courses: [] };
  }

  const [batchYears, diplomas] = await Promise.all([getBatchYears(), getProgrammeDiplomas(student.programme)]);
  const batchYear = batchYears.get(student.batch) ?? null;
  const semester = computeStudentSemester(batchYear, registration.semester, registration.year);
  const diploma = diplomaForTerm(diplomas, batchYear, { semester: registration.semester as "FALL", year: registration.year });
  const base = { registrationOpen: true, registration, semester, diploma };

  if (await hasPendingGrades(student.id, registration.id)) {
    return {
      ...base,
      message: PENDING_GRADES_MESSAGE,
      gradesPending: true,
      courses: [],
      creditLimit: DEFAULT_CREDIT_LIMIT,
      creditsUsed: 0,
    };
  }

  if (await prepare(student, diploma, diplomas, semester, registration.id)) {
    student = await getSelfStudent(userId);
  }

  const [enrollments, creditLimit, failedRows] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: student.id, registrationId: registration.id },
      include: { course: { select: { creditHours: true } } },
    }),
    creditLimitFor(registration.id, student.batch),
    prisma.enrollment.findMany({ where: { studentId: student.id, ...visibleFailWhere() }, select: { courseId: true } }),
  ]);
  const failedIds = new Set(failedRows.map((r) => r.courseId));
  const enrolledByCourse = new Map(enrollments.map((e) => [e.courseId, e]));
  const creditsUsed = enrollments.reduce((sum, e) => sum + e.course.creditHours, 0);
  const homeSectionIds = diploma
    ? student.enrolledSections.filter((s) => s.departmentId === diploma.id && s.batch === student.batch).map((s) => s.id)
    : [];

  let message: string | null = null;
  if (!semester || semester < 1) {
    message = "Your batch has not started yet.";
  } else if (!diploma) {
    message = "You have completed every semester of your programme.";
  } else if (homeSectionIds.length === 0) {
    message = "You are not yet assigned to a section. Contact an administrator.";
  }

  if (!diploma) {
    // No diploma this term, but an admin may still have offered courses to the batch.
    const extra = await findExtraOfferedCourses(student, diplomas, registration.id);
    const courses = extra.map((course) =>
      toOffered(
        course,
        student,
        enrolledByCourse,
        student.enrolledSections.map((s) => s.id),
        Boolean(semester) && course.department.semester < (semester ?? 0),
        failedIds,
      ),
    );
    if (courses.some((c) => c.missed)) {
      message = null; // courses still to make up: the programme isn't complete
    }
    return { ...base, message, courses, creditLimit, creditsUsed };
  }
  if (message) {
    return { ...base, message, courses: [], creditLimit, creditsUsed };
  }

  const batchSectionIds = (
    await prisma.section.findMany({ where: { departmentId: diploma.id, batch: student.batch }, select: { id: true } })
  ).map((s) => s.id);
  // Everything offered to the batch's sections of this diploma.
  const offered = await prisma.course.findMany({
    where: { sectionLinks: { some: { sectionId: { in: batchSectionIds } } } },
    include: offeredInclude({ id: { in: batchSectionIds } }),
    orderBy: { code: "asc" },
  });
  const offeredIds = new Set(offered.map((c) => c.id));
  const [missedCourses, missedRegisteredNow] = await Promise.all([
    findMissedCourses(student, diplomas, diploma.semester, registration.id),
    prisma.course.findMany({
      where: { id: { in: enrollments.filter((e) => !offeredIds.has(e.courseId)).map((e) => e.courseId) } },
      include: offeredInclude({ batch: student.batch }),
    }),
  ]);
  const missedNowIds = new Set(missedRegisteredNow.map((c) => c.id));
  const missed = [
    ...missedCourses.filter((c) => !offeredIds.has(c.id) && !missedNowIds.has(c.id)),
    ...missedRegisteredNow,
  ].sort((a, b) => a.department.semester - b.department.semester || a.code.localeCompare(b.code));

  const enrolledSectionIds = student.enrolledSections.map((s) => s.id);
  const courses = [
    ...missed.map((c) => toOffered(c, student, enrolledByCourse, enrolledSectionIds, true, failedIds)),
    ...offered.map((c) => toOffered(c, student, enrolledByCourse, homeSectionIds, false, failedIds)),
  ];
  return {
    ...base,
    creditLimit,
    creditsUsed,
    courses,
    message: courses.length === 0 ? `${diploma.name} has no courses yet. Contact an administrator.` : null,
  };
}

/** Registers the student for a course in a section, updates their challan and the class roster. */
export async function registerCourse(userId: string, input: z.infer<typeof registerSchema>) {
  const student = await getSelfStudent(userId);
  const registration = await findActiveRegistration();
  if (!registration) {
    throw badRequest("Registration is not currently open.");
  }
  if (await hasPendingGrades(student.id, registration.id)) {
    throw badRequest(PENDING_GRADES_MESSAGE);
  }
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) {
    throw notFoundError("Course not found.");
  }
  const [batchYears, diplomas, section] = await Promise.all([
    getBatchYears(),
    getProgrammeDiplomas(student.programme),
    prisma.section.findUnique({ where: { id: input.sectionId } }),
  ]);
  const diploma = diplomaForTerm(diplomas, batchYears.get(student.batch) ?? null, {
    semester: registration.semester as "FALL",
    year: registration.year,
  });
  if (!section || section.batch !== student.batch) {
    throw badRequest("Invalid section for your batch.");
  }
  const offering = await prisma.sectionCourse.findUnique({
    where: { sectionId_courseId: { sectionId: input.sectionId, courseId: input.courseId } },
  });
  if (!offering) {
    throw badRequest("This course is not offered to that section.");
  }
  if (!diploma) {
    const extra = await findExtraOfferedCourses(student, diplomas, registration.id);
    if (!extra.some((c) => c.id === course.id) || !diplomas.some((d) => d.id === section.departmentId)) {
      throw badRequest("This course isn't offered to your batch this semester.");
    }
  } else if (section.departmentId !== diploma.id) {
    // A course offered elsewhere only if the student missed it in an earlier semester.
    const missed = await findMissedCourses(student, diplomas, diploma.semester, registration.id);
    if (!missed.some((c) => c.id === course.id)) {
      throw badRequest("This course isn't part of your diploma for this semester.");
    }
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_registrationId_courseId: { studentId: student.id, registrationId: registration.id, courseId: course.id },
    },
  });
  if (existing) {
    throw conflictError("You are already registered for this course.");
  }
  const [current, creditLimit] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: student.id, registrationId: registration.id },
      include: { course: { select: { creditHours: true } } },
    }),
    creditLimitFor(registration.id, student.batch),
  ]);
  const creditsUsed = current.reduce((sum, e) => sum + e.course.creditHours, 0);
  if (creditsUsed + course.creditHours > creditLimit) {
    throw badRequest(
      `Registering ${course.code} (${course.creditHours} CR) would exceed your credit limit of ${creditLimit}. You currently have ${creditsUsed} CR registered.`,
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: { studentId: student.id, registrationId: registration.id, courseId: course.id, sectionId: input.sectionId },
  });
  await syncChallan(student.id, registration.id);
  // Joins the course's classroom.
  await syncClassroomsFor([{ courseId: course.id, sectionId: input.sectionId }]);
  return { enrollment, message: `Registered for ${course.code}. You've been added to its classroom.` };
}

/** Courses the student is registered in, grouped by term (newest first), with teacher and classroom. */
export async function getMyCourses(userId: string) {
  const student = await getSelfStudent(userId);
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      registration: true,
      course: { include: { department: { select: { id: true, code: true, name: true, semester: true } } } },
      section: { select: { id: true, label: true, batch: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const links = enrollments.length
    ? await prisma.sectionCourse.findMany({
        where: { OR: enrollments.map((e) => ({ sectionId: e.sectionId, courseId: e.courseId })) },
        include: { teacher: { select: { id: true, name: true, email: true } }, classroom: { select: { id: true } } },
      })
    : [];
  const linkFor = new Map(links.map((l) => [`${l.sectionId}-${l.courseId}`, l]));
  const groups = new Map<string, { semester: string; year: number; courses: unknown[] }>();
  for (const e of enrollments) {
    const key = `${e.registration.semester}-${e.registration.year}`;
    if (!groups.has(key)) {
      groups.set(key, { semester: e.registration.semester, year: e.registration.year, courses: [] });
    }
    const link = linkFor.get(`${e.sectionId}-${e.courseId}`);
    groups.get(key)!.courses.push({
      enrollmentId: e.id,
      id: e.course.id,
      code: e.course.code,
      name: e.course.name,
      creditHours: e.course.creditHours,
      department: e.course.department,
      section: e.section,
      teacher: link?.teacher ?? null,
      classroomId: link?.classroom?.id ?? null,
    });
  }
  return {
    groups: [...groups.values()].sort(
      (a, b) => b.year - a.year || SEMESTER_RANK[b.semester] - SEMESTER_RANK[a.semester],
    ),
  };
}
