import { z } from "zod";

export const TEACHER_TYPES = ["PERMANENT", "VISITING"] as const;

export const amountField = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(100_000_000, `${label} is too large`);

interface PaySettings {
  type?: string | null;
  salary?: number | null;
  ratePerCreditHour?: number | null;
}

/** Why a teacher's pay settings are incomplete, or null. */
export function payError({ type, salary, ratePerCreditHour }: PaySettings): string | null {
  if (type === "PERMANENT" && salary == null) {
    return "Salary is required for a permanent teacher";
  }
  if (type === "VISITING" && ratePerCreditHour == null) {
    return "Rate per credit hour is required for a visiting teacher";
  }
  return null;
}

/**
 * A teacher's pay. Permanent: their fixed salary. Visiting: every credit hour
 * they teach (each section of a course counts separately) times their rate.
 */
export function teacherPay(teacher: PaySettings & { sectionCourses?: { course: { creditHours: number } }[] }) {
  const creditHours = (teacher.sectionCourses ?? []).reduce((sum, link) => sum + link.course.creditHours, 0);
  const pay =
    teacher.type === "VISITING" ? creditHours * (teacher.ratePerCreditHour ?? 0) : (teacher.salary ?? 0);
  return { creditHours, pay };
}
