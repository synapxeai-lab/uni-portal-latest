import { prisma } from "@/lib/prisma";

import { applyDiscount, courseTotalFee, PAYMENT_ACCOUNT_NUMBER } from "./fee";

type ChargedCourse = {
  id: number;
  fee: number;
  discountRate: number;
  departmentId: number;
  extraFees: { amount: number }[];
  department: { discountRate: number; courses: { id: number }[] };
};

/**
 * The fee for a set of registered courses. Courses are grouped by diploma:
 * registering every course of a discounted diploma applies the diploma's
 * discount to its whole fee; otherwise each course is charged its own fee
 * less its own discount.
 */
export function feeForCourses(courses: ChargedCourse[]): number {
  const byDiploma = new Map<number, ChargedCourse[]>();
  for (const course of courses) {
    byDiploma.set(course.departmentId, [...(byDiploma.get(course.departmentId) ?? []), course]);
  }
  let total = 0;
  for (const taken of byDiploma.values()) {
    const { department } = taken[0];
    const takenIds = new Set(taken.map((c) => c.id));
    const wholeDiploma = department.courses.every((c) => takenIds.has(c.id));
    total +=
      wholeDiploma && department.discountRate > 0
        ? applyDiscount(
            taken.reduce((sum, c) => sum + courseTotalFee(c), 0),
            department.discountRate,
          )
        : taken.reduce((sum, c) => sum + applyDiscount(courseTotalFee(c), c.discountRate), 0);
  }
  return total;
}

/**
 * Recomputes a student's challan for one registration period from the fees of
 * the courses they're registered for:
 * - an unpaid or awaiting-approval challan shows the new amount; if it went
 *   up while a payment awaits approval, it's unpaid again;
 * - a paid challan only changes when the amount goes up (an extra course),
 *   and is then unpaid for the new amount;
 * - nothing to pay means no challan (an unpaid one is removed).
 */
export async function syncChallan(studentId: number, registrationId: number): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, registrationId },
    include: {
      course: {
        include: {
          extraFees: true,
          department: { select: { discountRate: true, courses: { select: { id: true } } } },
        },
      },
    },
  });
  const amount = feeForCourses(enrollments.map((e) => e.course));
  const existing = await prisma.challan.findUnique({
    where: { studentId_registrationId: { studentId, registrationId } },
  });

  if (existing) {
    if (existing.amount === amount) {
      return;
    }
    if (existing.status === "PAID") {
      if (amount > existing.amount) {
        await prisma.challan.update({ where: { id: existing.id }, data: { amount, status: "UNPAID" } });
      }
      return;
    }
    if (amount === 0) {
      await prisma.challan.delete({ where: { id: existing.id } });
      return;
    }
    await prisma.challan.update({
      where: { id: existing.id },
      // A pending payment still covers a lower amount; a higher one needs paying again.
      data: { amount, ...(amount > existing.amount ? { status: "UNPAID" } : {}) },
    });
  } else if (amount > 0) {
    await prisma.challan.create({
      data: { studentId, registrationId, amount, accountNumber: PAYMENT_ACCOUNT_NUMBER },
    });
  }
}

/** Every registration period the student has courses in gets an up-to-date challan. */
export async function syncChallansForStudent(studentId: number): Promise<void> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId },
    select: { registrationId: true },
    distinct: ["registrationId"],
  });
  for (const { registrationId } of rows) {
    await syncChallan(studentId, registrationId);
  }
}

/** Every student with courses: used by the admin challans list (catches fee edits). */
export async function syncAllChallans(): Promise<void> {
  const pairs = await prisma.enrollment.findMany({
    select: { studentId: true, registrationId: true },
    distinct: ["studentId", "registrationId"],
  });
  for (const { studentId, registrationId } of pairs) {
    await syncChallan(studentId, registrationId);
  }
}
