import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { AssignmentStatus, ModerationStatus } from "@/generated/prisma/enums";
import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { compareTypes, COMPONENTS, syncCourseCategories, syncSectionCategories, validateScheme } from "../lib/assessment-scheme";
import { DEFAULT_GRADES, GRADE_LETTERS, type GradeRange, validateGrades } from "../lib/grading";
import { importAssignmentMarks } from "../lib/classwork-marks";
import { conflictError, notFoundError } from "../lib/http";
import { summarizeEnrollments, summarizeMarks, weightsFor } from "../lib/marks-summary";
import { assertTeachesOffering } from "../lib/self";

type Viewer = { id: string; role: string };

// Quizzes, assignments, projects and labs are numbered; mid, practical and final are single exams.
const TITLE_PREFIX: Record<string, string> = { QUIZ: "Quiz", ASSIGNMENT: "Assignment", PROJECT: "Project", LAB: "Lab" };
const SINGLE_TITLE: Record<string, string> = { MID: "Mid Term", PRACTICAL: "Practical Exam", FINAL: "Final Term" };

export const totalMarksSchema = z.object({
  totalMarks: z.number({ error: "Total marks is required" }).positive("Total marks must be greater than 0").max(1000, "Total marks is too large"),
});
export const createAssessmentSchema = totalMarksSchema.extend({
  // A classroom assignment whose returned grades fill this item's marks.
  assignmentId: z.uuid("Pick a valid assignment").nullish(),
});
export const saveMarksSchema = z.object({
  records: z.array(
    z.object({ enrollmentId: z.number().int(), obtained: z.number().min(0, "Marks cannot be negative").nullable() }),
  ),
});
export const saveStudentMarksSchema = z.object({
  records: z.array(
    z.object({ assessmentId: z.number().int(), obtained: z.number().min(0, "Marks cannot be negative").nullable() }),
  ),
});
export const gradingSchema = z.object({
  grades: z.array(z.object({ grade: z.enum(GRADE_LETTERS), min: z.number(), max: z.number() })),
});
export const percentageOverrideSchema = z.object({
  percentage: z.number().min(0, "Percentage cannot be below 0").max(100, "Percentage cannot be above 100").nullable(),
});
export const gradeOverrideSchema = z.object({ grade: z.enum(GRADE_LETTERS, { error: "Pick a valid grade" }).nullable() });
export const schemeSchema = z.object({
  theoryPercent: z.number().int().min(0, "Theory percent cannot be negative").max(100, "Theory percent cannot be more than 100"),
  entries: z.array(
    z.object({
      id: z.number().int().optional(),
      type: z.string().trim().min(1, "Every assessment needs a name").max(40, "Assessment names must be at most 40 characters"),
      component: z.enum(COMPONENTS, { error: "Pick theory or practical" }),
      weightage: z.number().gt(0, "Weightage must be more than 0").max(100, "Weightage cannot be more than 100"),
    }),
  ),
});
export const generateSchema = z.object({
  courseId: z.number().int().nullable(),
  visibleFrom: z.coerce.date({ error: "Pick a valid date" }),
});
export const releaseDateSchema = z.object({ visibleFrom: z.coerce.date({ error: "Pick a valid date" }) });

// ---- Marks sheet ------------------------------------------------------------------------

/**
 * The whole marks page for one offering in one call: categories with their
 * assessments, every registered student's marks and summary, and the grading
 * ranges.
 */
export async function getMarksSheet(viewer: Viewer, sectionId: number, courseId: number) {
  const offering = await assertTeachesOffering(viewer, sectionId, courseId);
  await syncSectionCategories(prisma, courseId, sectionId);
  const [categories, enrollments, criteria, classwork] = await Promise.all([
    prisma.assessmentCategory.findMany({
      where: { courseId, sectionId },
      include: {
        assessments: { orderBy: { createdAt: "asc" }, include: { assignment: { select: { id: true, title: true } } } },
        courseAssessment: { select: { component: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: { courseId, sectionId },
      include: { student: { select: { id: true, name: true, rollNo: true } }, marks: true },
      orderBy: { student: { name: "asc" } },
    }),
    prisma.gradingCriteria.findUnique({ where: { courseId_sectionId: { courseId, sectionId } } }),
    // Graded assignments in this offering's classroom that a marks item can be linked to.
    offering.classroom
      ? prisma.assignment.findMany({
          where: { ...linkableAssignment, classroomId: offering.classroom.id },
          select: { id: true, title: true, points: true, assessment: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const grades = (criteria?.grades as unknown as GradeRange[] | undefined) ?? DEFAULT_GRADES;
  const weights = weightsFor(categories);
  const sorted = categories.sort((a, b) => compareTypes(a.type, b.type) || a.id - b.id);
  const assessments = sorted.flatMap((c) => c.assessments.map((a) => ({ ...a, categoryId: c.id })));
  return {
    offering,
    categories: sorted.map((c) => ({
      id: c.id,
      type: c.type,
      weightage: c.weightage,
      component: c.courseAssessment?.component ?? null,
      fromScheme: c.courseAssessmentId !== null,
      singleAssessment: Boolean(SINGLE_TITLE[c.type]),
      assessments: c.assessments.map((a) => ({ id: a.id, title: a.title, totalMarks: a.totalMarks, assignment: a.assignment })),
    })),
    classwork: classwork.map((a) => ({ id: a.id, title: a.title, points: a.points!, linked: a.assessment !== null })),
    students: enrollments.map((e) => {
      const obtainedBy = new Map(e.marks.map((m) => [m.assessmentId, m.obtained]));
      const items = assessments.map((a) => ({ categoryId: a.categoryId, obtained: obtainedBy.get(a.id) ?? null, total: a.totalMarks }));
      return {
        enrollmentId: e.id,
        student: e.student,
        marks: Object.fromEntries(assessments.map((a) => [a.id, obtainedBy.get(a.id) ?? null])),
        summary: summarizeMarks(items, e.percentageOverride, grades, e.gradeOverride, weights),
        published: e.publishedGrade ? { grade: e.publishedGrade, visibleFrom: e.gradeVisibleFrom } : null,
      };
    }),
    grading: { grades, custom: Boolean(criteria) },
    weighted: Boolean(weights),
    totalWeightage: categories.reduce((sum, c) => sum + (c.weightage ?? 0), 0),
    hasScheme: categories.some((c) => c.courseAssessmentId !== null),
  };
}

async function loadCategory(viewer: Viewer, categoryId: number) {
  const category = await prisma.assessmentCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw notFoundError("Assessment section not found.");
  await assertTeachesOffering(viewer, category.sectionId, category.courseId);
  return category;
}

async function loadAssessment(viewer: Viewer, assessmentId: number) {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId }, include: { category: true } });
  if (!assessment) throw notFoundError("Assessment not found.");
  await assertTeachesOffering(viewer, assessment.category.sectionId, assessment.category.courseId);
  return assessment;
}

/** A published, graded, not-deleted assignment. */
const linkableAssignment = {
  deletedAt: null,
  moderationStatus: ModerationStatus.ACTIVE,
  status: { in: [AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED] },
  points: { not: null },
} satisfies Prisma.AssignmentWhereInput;

/** The assignment to link: graded, in this offering's classroom, and not linked to another item. */
async function assertLinkableAssignment(sectionId: number, courseId: number, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { ...linkableAssignment, id: assignmentId, classroom: { sectionCourse: { sectionId, courseId } } },
    select: { id: true, assessment: { select: { title: true } } },
  });
  if (!assignment) throw badRequest("Pick a published, graded assignment from this course's classroom.");
  if (assignment.assessment) throw conflictError(`That assignment already feeds ${assignment.assessment.title}.`);
}

/** Adds the next item to a category ("Quiz 3"), or its single exam ("Mid Term"), optionally fed by an assignment. */
export async function createAssessment(viewer: Viewer, categoryId: number, totalMarks: number, assignmentId?: string | null) {
  const category = await loadCategory(viewer, categoryId);
  if (assignmentId) await assertLinkableAssignment(category.sectionId, category.courseId, assignmentId);
  const existing = await prisma.assessment.findMany({ where: { categoryId }, select: { title: true } });
  let title: string;
  if (SINGLE_TITLE[category.type]) {
    if (existing.length > 0) throw conflictError(`${SINGLE_TITLE[category.type]} already exists.`);
    title = SINGLE_TITLE[category.type];
  } else {
    // After the highest number so deleting "Quiz 2" of three doesn't repeat "Quiz 3".
    const prefix = TITLE_PREFIX[category.type] ?? category.type;
    const numbers = existing.map((a) => Number.parseInt(a.title.slice(prefix.length + 1), 10)).filter((n) => !Number.isNaN(n));
    title = `${prefix} ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
  }
  const created = await prisma.assessment.create({ data: { categoryId, title, totalMarks, assignmentId: assignmentId ?? null } });
  if (assignmentId) await importAssignmentMarks(created.id);
  return created;
}

export async function updateAssessment(viewer: Viewer, assessmentId: number, totalMarks: number) {
  const assessment = await loadAssessment(viewer, assessmentId);
  if (assessment.assignmentId) {
    // Linked marks are scaled from the assignment's grades, so re-scale them to the new total.
    const updated = await prisma.assessment.update({ where: { id: assessment.id }, data: { totalMarks } });
    await importAssignmentMarks(assessment.id);
    return updated;
  }
  const highest = await prisma.mark.aggregate({ where: { assessmentId }, _max: { obtained: true } });
  if (highest._max.obtained !== null && highest._max.obtained > totalMarks) {
    throw badRequest(`A student already has ${highest._max.obtained} marks - the total can't be lower than that.`);
  }
  return prisma.assessment.update({ where: { id: assessment.id }, data: { totalMarks } });
}

export async function deleteAssessment(viewer: Viewer, assessmentId: number) {
  const assessment = await loadAssessment(viewer, assessmentId);
  await prisma.assessment.delete({ where: { id: assessmentId } });
  return assessment;
}

/** Only a category left over from before course schemes can be deleted. */
export async function deleteCategory(viewer: Viewer, categoryId: number) {
  const category = await loadCategory(viewer, categoryId);
  if (category.courseAssessmentId !== null) {
    throw badRequest("This section is part of the course's assessment scheme. An administrator can change it on the course page.");
  }
  await prisma.assessmentCategory.delete({ where: { id: categoryId } });
}

/** Saves marks (null clears one); records for students not registered here are ignored. */
export async function saveMarks(viewer: Viewer, assessmentId: number, records: z.infer<typeof saveMarksSchema>["records"]) {
  const assessment = await loadAssessment(viewer, assessmentId);
  if (records.some((r) => r.obtained !== null && r.obtained > assessment.totalMarks)) {
    throw badRequest(`Marks can't exceed the total of ${assessment.totalMarks}.`);
  }
  const { courseId, sectionId } = assessment.category;
  const valid = new Set(
    (await prisma.enrollment.findMany({ where: { courseId, sectionId }, select: { id: true } })).map((e) => e.id),
  );
  const toSave = records.filter((r) => valid.has(r.enrollmentId));
  await prisma.$transaction([
    ...toSave
      .filter((r) => r.obtained === null)
      .map((r) => prisma.mark.deleteMany({ where: { assessmentId, enrollmentId: r.enrollmentId } })),
    ...toSave
      .filter((r) => r.obtained !== null)
      .map((r) =>
        prisma.mark.upsert({
          where: { assessmentId_enrollmentId: { assessmentId, enrollmentId: r.enrollmentId } },
          update: { obtained: r.obtained! },
          create: { assessmentId, enrollmentId: r.enrollmentId, obtained: r.obtained! },
        }),
      ),
  ]);
  return { saved: toSave.length };
}

/**
 * One student's marksheet: marks for any of the course section's assessments
 * (null clears one). Assessments from other courses or sections are refused.
 */
export async function saveStudentMarks(
  viewer: Viewer,
  enrollmentId: number,
  records: z.infer<typeof saveStudentMarksSchema>["records"],
) {
  const enrollment = await loadEnrollmentFor(viewer, enrollmentId);
  const ids = [...new Set(records.map((r) => r.assessmentId))];
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: ids }, category: { courseId: enrollment.courseId, sectionId: enrollment.sectionId } },
    select: { id: true, title: true, totalMarks: true },
  });
  const byId = new Map(assessments.map((a) => [a.id, a]));
  if (byId.size !== ids.length) {
    throw badRequest("Some of these assessments aren't part of this course section.");
  }
  const over = records.find((r) => r.obtained !== null && r.obtained > byId.get(r.assessmentId)!.totalMarks);
  if (over) {
    const assessment = byId.get(over.assessmentId)!;
    throw badRequest(`${assessment.title}: marks can't exceed the total of ${assessment.totalMarks}.`);
  }
  await prisma.$transaction(
    records.map((r) =>
      r.obtained === null
        ? prisma.mark.deleteMany({ where: { assessmentId: r.assessmentId, enrollmentId } })
        : prisma.mark.upsert({
            where: { assessmentId_enrollmentId: { assessmentId: r.assessmentId, enrollmentId } },
            update: { obtained: r.obtained },
            create: { assessmentId: r.assessmentId, enrollmentId, obtained: r.obtained },
          }),
    ),
  );
  return { saved: records.length };
}

export async function saveGrading(viewer: Viewer, sectionId: number, courseId: number, grades: GradeRange[]) {
  const invalid = validateGrades(grades);
  if (invalid) throw badRequest(invalid);
  await assertTeachesOffering(viewer, sectionId, courseId);
  const data = grades.map(({ grade, min, max }) => ({ grade, min, max }));
  await prisma.gradingCriteria.upsert({
    where: { courseId_sectionId: { courseId, sectionId } },
    update: { grades: data },
    create: { courseId, sectionId, grades: data },
  });
}

async function loadEnrollmentFor(viewer: Viewer, enrollmentId: number) {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw notFoundError("Registration not found.");
  await assertTeachesOffering(viewer, enrollment.sectionId, enrollment.courseId);
  return enrollment;
}

/** Admin: replace the computed course percentage (null removes the override). */
export async function setPercentageOverride(viewer: Viewer, enrollmentId: number, percentage: number | null) {
  await loadEnrollmentFor(viewer, enrollmentId);
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { percentageOverride: percentage } });
}

/** Teacher or admin: set the letter grade directly (null follows the criteria again). */
export async function setGradeOverride(viewer: Viewer, enrollmentId: number, grade: string | null) {
  await loadEnrollmentFor(viewer, enrollmentId);
  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { gradeOverride: grade },
    include: { marks: true },
  });
  return (await summarizeEnrollments(prisma, [updated])).get(updated.id);
}

// ---- Course assessment scheme (admin) ------------------------------------------------------

/**
 * Replaces the course's theory/practical split and assessment sections, then
 * updates every offered section's categories. Removing an entry that already
 * has items in some section is refused, so marks are never deleted from here.
 */
export async function saveScheme(courseId: number, input: z.infer<typeof schemeSchema>) {
  const invalid = validateScheme(input.entries, input.theoryPercent);
  if (invalid) throw badRequest(invalid);
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { assessmentScheme: true } });
  if (!course) throw notFoundError("Course not found.");

  const byId = new Map(course.assessmentScheme.map((e) => [e.id, e]));
  const byType = new Map(course.assessmentScheme.map((e) => [e.type, e]));
  const matched = input.entries.map((e) => (e.id != null ? byId.get(e.id) : undefined) ?? byType.get(e.type) ?? null);
  const kept = new Set(matched.filter(Boolean).map((e) => e!.id));
  const removed = course.assessmentScheme.filter((e) => !kept.has(e.id));
  if (removed.length) {
    const inUse = await prisma.assessmentCategory.findFirst({
      where: { courseAssessmentId: { in: removed.map((e) => e.id) }, assessments: { some: {} } },
    });
    if (inUse) {
      throw conflictError(
        "An assessment you removed already has items or marks in a section. Ask the teacher to delete them from the marks page first.",
      );
    }
  }
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.course.update({ where: { id: courseId }, data: { theoryPercent: input.theoryPercent } }),
    prisma.courseAssessment.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } }),
  ];
  input.entries.forEach(({ id: _id, ...entry }, i) => {
    const existing = matched[i];
    if (!existing) {
      ops.push(prisma.courseAssessment.create({ data: { courseId, ...entry } }));
      return;
    }
    ops.push(prisma.courseAssessment.update({ where: { id: existing.id }, data: entry }));
    if (existing.type !== entry.type) {
      // A rename carries over to the sections' categories made from this entry.
      ops.push(prisma.assessmentCategory.updateMany({ where: { courseAssessmentId: existing.id }, data: { type: entry.type } }));
    }
  });
  await prisma.$transaction(ops);
  await syncCourseCategories(prisma, courseId);
}

// ---- Grades: generate and release ---------------------------------------------------------

/** The offerings the viewer acts on: all for an admin, their own for a teacher. */
async function scope(viewer: Viewer, courseId: number | null) {
  const where: Prisma.SectionCourseWhereInput = {
    ...(courseId === null ? {} : { courseId }),
    ...(viewer.role === "ADMIN" ? {} : { teacher: { userId: viewer.id } }),
  };
  return prisma.sectionCourse.findMany({
    where,
    include: {
      section: { select: { id: true, label: true, batch: true, department: { select: { code: true } } } },
      teacher: { select: { id: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true } },
    },
    orderBy: [{ course: { code: "asc" } }, { section: { batch: "asc" } }, { section: { label: "asc" } }],
  });
}

const inLinks = (links: { courseId: number; sectionId: number }[]): Prisma.EnrollmentWhereInput => ({
  OR: links.map((l) => ({ courseId: l.courseId, sectionId: l.sectionId })),
});

/** The course sections the viewer keeps marks and attendance for (teacher: own; admin: all), with student counts. */
export async function teachingOfferings(viewer: Viewer) {
  const links = await scope(viewer, null);
  if (links.length === 0) {
    return { offerings: [] };
  }
  const counts = await prisma.enrollment.groupBy({
    by: ["courseId", "sectionId"],
    where: inLinks(links),
    _count: { _all: true },
  });
  const byKey = new Map(counts.map((c) => [`${c.sectionId}-${c.courseId}`, c._count._all]));
  return {
    offerings: links.map((l) => ({
      sectionId: l.sectionId,
      courseId: l.courseId,
      course: l.course,
      section: l.section,
      teacher: l.teacher,
      students: byKey.get(`${l.sectionId}-${l.courseId}`) ?? 0,
    })),
  };
}

/** The Grades page: the offerings in scope, with student counts and how many have a generated grade. */
export async function gradesOverview(viewer: Viewer) {
  const links = await scope(viewer, null);
  if (links.length === 0) {
    return { offerings: [], releases: [] };
  }
  const [counts, releases] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["courseId", "sectionId"],
      where: inLinks(links),
      _count: { _all: true, publishedGrade: true },
    }),
    gradeReleases(viewer, links),
  ]);
  const byKey = new Map(counts.map((c) => [`${c.sectionId}-${c.courseId}`, c._count]));
  return {
    offerings: links.map((l) => ({
      sectionId: l.sectionId,
      courseId: l.courseId,
      course: l.course,
      section: l.section,
      teacher: l.teacher,
      classroomId: l.classroom?.id ?? null,
      students: byKey.get(`${l.sectionId}-${l.courseId}`)?._all ?? 0,
      generated: byKey.get(`${l.sectionId}-${l.courseId}`)?.publishedGrade ?? 0,
    })),
    releases,
  };
}

/** Snapshots current grades and schedules when students see them. Students with no marks are skipped. */
export async function generateGrades(viewer: Viewer, input: z.infer<typeof generateSchema>) {
  const links = await scope(viewer, input.courseId);
  if (links.length === 0) {
    throw notFoundError(input.courseId === null ? "There are no courses to generate grades for." : "You have no sections for this course.");
  }
  const enrollments = await prisma.enrollment.findMany({ where: inLinks(links), include: { marks: true } });
  const summaries = await summarizeEnrollments(prisma, enrollments);
  const toPublish = enrollments.filter((e) => summaries.get(e.id)?.grade);
  const generatedAt = new Date();
  await prisma.$transaction(
    toPublish.map((e) =>
      prisma.enrollment.update({
        where: { id: e.id },
        data: { publishedGrade: summaries.get(e.id)!.grade, gradeVisibleFrom: input.visibleFrom, gradeGeneratedAt: generatedAt },
      }),
    ),
  );
  const skipped = enrollments.length - toPublish.length;
  const courses = new Set(toPublish.map((e) => e.courseId)).size;
  return {
    generated: toPublish.length,
    skipped,
    message:
      `Grades generated for ${toPublish.length} student${toPublish.length === 1 ? "" : "s"}` +
      (input.courseId === null ? ` across ${courses} course${courses === 1 ? "" : "s"}` : "") +
      (skipped ? ` · ${skipped} skipped (no marks yet)` : "") +
      ".",
  };
}

/** Generated grades, one row per course: students, visible-from range and when generated. */
async function gradeReleases(viewer: Viewer, links?: Awaited<ReturnType<typeof scope>>) {
  const inScope = links ?? (await scope(viewer, null));
  if (inScope.length === 0) return [];
  const groups = await prisma.enrollment.groupBy({
    by: ["courseId", "gradeVisibleFrom"],
    where: { ...inLinks(inScope), publishedGrade: { not: null } },
    _count: { _all: true },
    _max: { gradeGeneratedAt: true },
  });
  const byCourse = new Map<number, { courseId: number; students: number; visibleFrom: Date | null; visibleTo: Date | null; generatedAt: Date | null }>();
  for (const g of groups) {
    const entry = byCourse.get(g.courseId) ?? { courseId: g.courseId, students: 0, visibleFrom: null, visibleTo: null, generatedAt: null };
    entry.students += g._count._all;
    if (g.gradeVisibleFrom && (!entry.visibleFrom || g.gradeVisibleFrom < entry.visibleFrom)) entry.visibleFrom = g.gradeVisibleFrom;
    if (g.gradeVisibleFrom && (!entry.visibleTo || g.gradeVisibleFrom > entry.visibleTo)) entry.visibleTo = g.gradeVisibleFrom;
    if (g._max.gradeGeneratedAt && (!entry.generatedAt || g._max.gradeGeneratedAt > entry.generatedAt)) entry.generatedAt = g._max.gradeGeneratedAt;
    byCourse.set(g.courseId, entry);
  }
  const courseById = new Map(inScope.map((l) => [l.courseId, l.course]));
  return [...byCourse.values()]
    .map((entry) => ({ ...entry, course: courseById.get(entry.courseId)! }))
    .sort((a, b) => (b.generatedAt?.getTime() ?? 0) - (a.generatedAt?.getTime() ?? 0));
}

async function releaseWhere(viewer: Viewer, courseId: number): Promise<Prisma.EnrollmentWhereInput> {
  const links = await scope(viewer, courseId);
  if (links.length === 0) throw notFoundError("You have no sections for this course.");
  return { ...inLinks(links), publishedGrade: { not: null } };
}

export async function updateRelease(viewer: Viewer, courseId: number, visibleFrom: Date) {
  const { count } = await prisma.enrollment.updateMany({
    where: await releaseWhere(viewer, courseId),
    data: { gradeVisibleFrom: visibleFrom },
  });
  if (count === 0) throw notFoundError("No grades have been generated for this course.");
}

/** Unpublishes: students stop seeing the grades. */
export async function deleteRelease(viewer: Viewer, courseId: number) {
  const { count } = await prisma.enrollment.updateMany({
    where: await releaseWhere(viewer, courseId),
    data: { publishedGrade: null, gradeVisibleFrom: null, gradeGeneratedAt: null },
  });
  if (count === 0) throw notFoundError("No grades have been generated for this course.");
  return count;
}

