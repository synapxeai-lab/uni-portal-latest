import { prisma } from "@/lib/prisma";

import { getBatchYears } from "../lib/batches";
import { computeGpa, GRADE_POINTS, visibleGrade } from "../lib/grading";
import { compareTypes } from "../lib/assessment-scheme";
import { notFoundError } from "../lib/http";
import { summarizeMarks, weightsFor } from "../lib/marks-summary";
import { getSelfStudent } from "../lib/self";
import { computeStudentSemester } from "../lib/terms";

const SEMESTER_RANK: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

const enrollmentInclude = {
  registration: { select: { semester: true, year: true } },
  course: { select: { id: true, code: true, name: true, creditHours: true } },
  section: { select: { id: true, label: true } },
  marks: true,
} as const;

type MarksEnrollment = Awaited<ReturnType<typeof loadEnrollments>>[number];
const loadEnrollments = (where: { studentId: number; id?: number }) =>
  prisma.enrollment.findMany({ where, include: enrollmentInclude, orderBy: { createdAt: "asc" } });

/**
 * Each course with every assessment (obtained null until graded) and the
 * percentage so far. Students never get the live grade - only the generated
 * one, once its visible-from date has passed.
 */
async function toCourseMarks(enrollments: MarksEnrollment[]) {
  const categories =
    enrollments.length === 0
      ? []
      : await prisma.assessmentCategory.findMany({
          where: { OR: enrollments.map((e) => ({ courseId: e.courseId, sectionId: e.sectionId })) },
          include: { assessments: { orderBy: { createdAt: "asc" } } },
        });
  return enrollments.map((e) => {
    const obtainedBy = new Map(e.marks.map((m) => [m.assessmentId, m.obtained]));
    const own = categories
      .filter((c) => c.courseId === e.courseId && c.sectionId === e.sectionId)
      .sort((a, b) => compareTypes(a.type, b.type) || a.id - b.id);
    const marks = own.flatMap((c) =>
      c.assessments.map((a) => ({
        id: a.id,
        categoryId: c.id,
        type: c.type,
        weightage: c.weightage,
        title: a.title,
        obtained: obtainedBy.get(a.id) ?? null,
        total: a.totalMarks,
      })),
    );
    const { grade: _live, computedGrade: _computed, gradeAdjusted: _adjusted, ...summary } = summarizeMarks(
      marks,
      e.percentageOverride,
      undefined,
      null,
      weightsFor(own),
    );
    return {
      enrollmentId: e.id,
      id: e.course.id,
      code: e.course.code,
      name: e.course.name,
      creditHours: e.course.creditHours,
      section: e.section,
      summary: { ...summary, grade: visibleGrade(e) },
      // Every category of the scheme in order, so the marksheet shows ones with nothing in them yet.
      categories: own.map((c) => ({ id: c.id, type: c.type, weightage: c.weightage })),
      marks,
    };
  });
}

/** Marks per registered course, grouped by term. */
export async function getMyMarks(userId: string) {
  const student = await getSelfStudent(userId);
  const [enrollments, batchYears] = await Promise.all([loadEnrollments({ studentId: student.id }), getBatchYears()]);
  const batchYear = batchYears.get(student.batch) ?? null;
  const courses = await toCourseMarks(enrollments);
  const groups = new Map<string, { semester: string; year: number; semesterNumber: number | null; courses: unknown[] }>();
  enrollments.forEach((e, i) => {
    const key = `${e.registration.semester}-${e.registration.year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        semester: e.registration.semester,
        year: e.registration.year,
        semesterNumber: computeStudentSemester(batchYear, e.registration.semester, e.registration.year),
        courses: [],
      });
    }
    groups.get(key)!.courses.push(courses[i]);
  });
  return {
    groups: [...groups.values()].sort((a, b) => b.year - a.year || SEMESTER_RANK[b.semester] - SEMESTER_RANK[a.semester]),
  };
}

/** Marks for one registered course (scoped to this student). */
export async function getMyCourseMarks(userId: string, enrollmentId: number) {
  const student = await getSelfStudent(userId);
  const [enrollment] = await loadEnrollments({ studentId: student.id, id: enrollmentId });
  if (!enrollment) {
    throw notFoundError("Course not found.");
  }
  const [course] = await toCourseMarks([enrollment]);
  return { course: { ...course, semester: enrollment.registration.semester, year: enrollment.registration.year } };
}

/** Courses, released grades and GPA per semester (oldest first), with the CGPA. */
export async function getMyTranscript(userId: string) {
  const student = await getSelfStudent(userId);
  const [enrollments, batchYears] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: {
        registration: { select: { semester: true, year: true } },
        course: { include: { department: { select: { name: true, code: true } } } },
      },
      orderBy: { course: { code: "asc" } },
    }),
    getBatchYears(),
  ]);
  const batchYear = batchYears.get(student.batch) ?? null;
  const bySemester = new Map<
    string,
    {
      semester: string;
      year: number;
      semesterNumber: number | null;
      diploma: { name: string; code: string };
      courses: { enrollmentId: number; code: string; name: string; creditHours: number; grade: string | null; gradePoints: number | null }[];
    }
  >();
  for (const e of enrollments) {
    const key = `${e.registration.semester}-${e.registration.year}`;
    if (!bySemester.has(key)) {
      bySemester.set(key, {
        semester: e.registration.semester,
        year: e.registration.year,
        semesterNumber: computeStudentSemester(batchYear, e.registration.semester, e.registration.year),
        diploma: { name: e.course.department.name, code: e.course.department.code },
        courses: [],
      });
    }
    const grade = visibleGrade(e);
    bySemester.get(key)!.courses.push({
      enrollmentId: e.id,
      code: e.course.code,
      name: e.course.name,
      creditHours: e.course.creditHours,
      grade,
      gradePoints: grade ? GRADE_POINTS[grade] : null,
    });
  }
  const semesters = [...bySemester.values()]
    .sort((a, b) => a.year - b.year || SEMESTER_RANK[a.semester] - SEMESTER_RANK[b.semester])
    .map((s) => ({ ...s, creditHours: s.courses.reduce((sum, c) => sum + c.creditHours, 0), gpa: computeGpa(s.courses) }));
  const all = semesters.flatMap((s) => s.courses);
  return {
    student: { name: student.name, rollNo: student.rollNo, batch: student.batch, programme: student.programme },
    semesters,
    totalCreditHours: all.reduce((sum, c) => sum + c.creditHours, 0),
    cgpa: computeGpa(all),
  };
}
