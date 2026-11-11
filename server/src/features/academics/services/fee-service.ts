import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { getBatchYears } from "../lib/batches";
import { syncAllChallans, syncChallan } from "../lib/challans";
import { notFoundError } from "../lib/http";
import { getSelfStudent } from "../lib/self";
import { teacherPay } from "../lib/teacher-pay";
import { computeStudentSemester, diplomaForTerm, type Term } from "../lib/terms";

const SEMESTER_RANK: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

/**
 * Challans are kept up to date when their amount can change (registration,
 * course fees and discounts), so reading them is a plain query. This
 * recalculates the challans of every registration of the given courses.
 */
export async function syncChallansForCourses(courseIds: number[]) {
  if (courseIds.length === 0) return;
  const pairs = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    select: { studentId: true, registrationId: true },
    distinct: ["studentId", "registrationId"],
  });
  for (const { studentId, registrationId } of pairs) {
    await syncChallan(studentId, registrationId);
  }
}

export async function syncChallansForDiploma(departmentId: number) {
  const courses = await prisma.course.findMany({ where: { departmentId }, select: { id: true } });
  await syncChallansForCourses(courses.map((c) => c.id));
}

/** The admin "recalculate" action: every challan from scratch. */
export const recalculateAllChallans = syncAllChallans;

/** A student's own challans, newest first, with their programme semester. */
export async function getMyChallans(userId: string) {
  const student = await getSelfStudent(userId);
  const [challans, batchYears] = await Promise.all([
    prisma.challan.findMany({
      where: { studentId: student.id },
      include: { registration: { select: { semester: true, year: true, endDate: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getBatchYears(),
  ]);
  const batchYear = batchYears.get(student.batch) ?? null;
  return {
    student: { name: student.name, rollNo: student.rollNo },
    challans: challans.map((c) => ({
      ...c,
      semester: computeStudentSemester(batchYear, c.registration.semester, c.registration.year),
    })),
  };
}

/** The student reports paying; an admin then approves it. */
export async function payChallan(userId: string, challanId: number) {
  const student = await getSelfStudent(userId);
  const challan = await prisma.challan.findUnique({ where: { id: challanId } });
  if (!challan || challan.studentId !== student.id) {
    throw notFoundError("Challan not found.");
  }
  if (challan.status !== "UNPAID") {
    throw badRequest(challan.status === "PAID" ? "This challan is already paid." : "This challan is already awaiting approval.");
  }
  return prisma.challan.update({ where: { id: challanId }, data: { status: "PENDING_APPROVAL" } });
}

export async function approveChallan(challanId: number) {
  const challan = await prisma.challan.findUnique({ where: { id: challanId } });
  if (!challan) throw notFoundError("Challan not found.");
  if (challan.status !== "PENDING_APPROVAL") {
    throw badRequest("Only challans awaiting approval can be approved.");
  }
  return prisma.challan.update({ where: { id: challanId }, data: { status: "PAID" } });
}

/** Admin: every challan (filterable), with the student and the diploma that term was for. */
export async function listChallans(params: { status?: string; programme?: string; search?: string; studentId?: number }) {
  const challans = await prisma.challan.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.studentId ? { studentId: params.studentId } : {}),
      student: {
        ...(params.programme ? { programme: params.programme } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: "insensitive" } },
                { rollNo: { contains: params.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    include: {
      registration: { select: { semester: true, year: true } },
      student: { select: { id: true, name: true, rollNo: true, programme: true, batch: true, section: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const programmes = [...new Set(challans.map((c) => c.student.programme))];
  const [diplomas, batchYears] = await Promise.all([
    prisma.department.findMany({
      where: { category: { in: programmes } },
      orderBy: [{ semester: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, category: true, semester: true },
    }),
    getBatchYears(),
  ]);
  const totals = { UNPAID: 0, PENDING_APPROVAL: 0, PAID: 0 } as Record<string, number>;
  for (const c of challans) totals[c.status] = (totals[c.status] ?? 0) + c.amount;
  return {
    totals,
    challans: challans
      .map((c) => {
        const batchYear = batchYears.get(c.student.batch) ?? null;
        const term = c.registration as Term;
        return {
          ...c,
          semester: computeStudentSemester(batchYear, term.semester, term.year),
          diploma: diplomaForTerm(
            diplomas.filter((d) => d.category === c.student.programme),
            batchYear,
            term,
          ),
        };
      })
      .sort(
        (a, b) =>
          b.registration.year - a.registration.year ||
          SEMESTER_RANK[b.registration.semester] - SEMESTER_RANK[a.registration.semester],
      ),
  };
}

/** Admin: every teacher's pay (permanent salary or credit hours taught x rate). */
export async function teachersPay() {
  const teachers = await prisma.teacher.findMany({
    include: {
      sectionCourses: {
        include: {
          course: { select: { id: true, code: true, name: true, creditHours: true } },
          section: { select: { id: true, label: true, batch: true } },
        },
        orderBy: [{ course: { code: "asc" } }, { section: { batch: "asc" } }, { section: { label: "asc" } }],
      },
    },
    orderBy: { name: "asc" },
  });
  return teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    programme: t.programme,
    type: t.type,
    salary: t.salary,
    ratePerCreditHour: t.ratePerCreditHour,
    courses: t.sectionCourses.map((sc) => ({ id: sc.id, course: sc.course, section: sc.section })),
    ...teacherPay(t),
  }));
}
