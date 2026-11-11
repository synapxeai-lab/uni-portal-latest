import { prisma } from "@/lib/prisma";

import { getBatchYears } from "../lib/batches";
import { computeGpa, GRADE_POINTS, visibleGrade } from "../lib/grading";
import { computeStudentSemester, diplomaForTerm, getProgrammeDiplomas, openRegistrationWhere } from "../lib/terms";
import { currentPeriods } from "./registration-service";

/**
 * The university part of each role's dashboard, in one request alongside the
 * classroom dashboard: the current term and registration plus the role's own
 * numbers. Each role's data is a handful of parallel count/aggregate queries.
 */
export async function adminSummary() {
  const [periods, teachers, students, programmes, diplomas, courses, offerings, pendingChallans, unpaid] = await Promise.all([
    currentPeriods(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.programmeCategory.count(),
    prisma.department.count(),
    prisma.course.count(),
    prisma.sectionCourse.count(),
    prisma.challan.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.challan.aggregate({ where: { status: "UNPAID" }, _sum: { amount: true } }),
  ]);
  const unassigned = await prisma.sectionCourse.count({ where: { teacherId: null } });
  return {
    role: "ADMIN" as const,
    ...periods,
    counts: { teachers, students, programmes, diplomas, courses, offerings, unassigned },
    fees: { pendingApprovals: pendingChallans, unpaidAmount: unpaid._sum.amount ?? 0 },
  };
}

export async function teacherSummary(userId: string) {
  const [periods, teacher] = await Promise.all([
    currentPeriods(),
    prisma.teacher.findUnique({
      where: { userId },
      include: {
        sectionCourses: {
          include: {
            course: { select: { id: true, code: true, name: true, creditHours: true } },
            section: { select: { id: true, label: true, batch: true, department: { select: { code: true } } } },
            classroom: { select: { id: true } },
          },
          orderBy: [{ course: { code: "asc" } }, { section: { label: "asc" } }],
        },
      },
    }),
  ]);
  if (!teacher) {
    return { role: "TEACHER" as const, ...periods, teaching: [] };
  }
  const offerings = teacher.sectionCourses;
  const stats = offerings.length
    ? await prisma.enrollment.groupBy({
        by: ["courseId", "sectionId"],
        where: { OR: offerings.map((o) => ({ courseId: o.courseId, sectionId: o.sectionId })) },
        _count: { _all: true },
      })
    : [];
  const studentsFor = new Map(stats.map((s) => [`${s.sectionId}-${s.courseId}`, s._count._all]));
  return {
    role: "TEACHER" as const,
    ...periods,
    teaching: offerings.map((o) => ({
      course: o.course,
      section: o.section,
      classroomId: o.classroom?.id ?? null,
      students: studentsFor.get(`${o.sectionId}-${o.courseId}`) ?? 0,
    })),
  };
}

export async function studentSummary(userId: string) {
  const [periods, student] = await Promise.all([
    currentPeriods(),
    prisma.student.findUnique({ where: { userId } }),
  ]);
  if (!student) {
    return { role: "STUDENT" as const, ...periods, profile: null };
  }
  const now = new Date();
  const [batchYears, diplomas, registration, enrollments, challans, attendance] = await Promise.all([
    getBatchYears(),
    getProgrammeDiplomas(student.programme),
    prisma.registration.findFirst({ where: openRegistrationWhere(now), orderBy: { startDate: "desc" } }),
    prisma.enrollment.findMany({
      where: { studentId: student.id },
      select: {
        registrationId: true,
        publishedGrade: true,
        gradeVisibleFrom: true,
        course: { select: { creditHours: true } },
      },
    }),
    prisma.challan.findMany({ where: { studentId: student.id, status: { not: "PAID" } }, select: { amount: true, status: true } }),
    prisma.attendance.groupBy({ by: ["status"], where: { enrollment: { studentId: student.id } }, _count: { _all: true } }),
  ]);
  const batchYear = batchYears.get(student.batch) ?? null;
  const term = registration ?? periods.semester;
  const semester = term ? computeStudentSemester(batchYear, term.semester, term.year) : null;
  const diploma = term ? diplomaForTerm(diplomas, batchYear, { semester: term.semester as "FALL", year: term.year }) : null;
  const graded = enrollments.map((e) => {
    const grade = visibleGrade(e, now);
    return { creditHours: e.course.creditHours, gradePoints: grade ? GRADE_POINTS[grade] : null };
  });
  const attended = attendance.filter((a) => a.status !== "ABSENT").reduce((n, a) => n + a._count._all, 0);
  const marked = attendance.reduce((n, a) => n + a._count._all, 0);
  return {
    role: "STUDENT" as const,
    ...periods,
    profile: {
      name: student.name,
      rollNo: student.rollNo,
      batch: student.batch,
      section: student.section,
      semester,
      diploma: diploma ? { name: diploma.name, code: diploma.code } : null,
    },
    registeredCredits: registration
      ? enrollments.filter((e) => e.registrationId === registration.id).reduce((n, e) => n + e.course.creditHours, 0)
      : null,
    cgpa: computeGpa(graded),
    attendance: marked ? Math.round((attended / marked) * 100) : null,
    fees: {
      due: challans.filter((c) => c.status === "UNPAID").reduce((n, c) => n + c.amount, 0),
      awaitingApproval: challans.some((c) => c.status === "PENDING_APPROVAL"),
    },
  };
}
