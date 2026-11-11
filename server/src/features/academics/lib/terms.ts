import type { Department, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { getBatchYears } from "./batches";

/**
 * Terms, registration windows and the diploma a batch studies.
 *
 * Calendar terms: Spring = Jan-May, Summer = Jun-Aug, Fall = Sep-Dec. New
 * intakes begin in Fall: Fall of the intake year is semester 1, and each
 * following Fall/Spring advances it by one (Summer doesn't). A programme's
 * diplomas are its semesters: a batch studies the diploma with
 * Department.semester = N in its Nth semester.
 */
export type Semester = "SPRING" | "SUMMER" | "FALL";
export const SEMESTERS: Semester[] = ["SPRING", "SUMMER", "FALL"];

export interface Term {
  semester: Semester;
  year: number;
}

// 0-indexed end month of each semester's window.
export const SEMESTER_END_MONTH: Record<Semester, number> = { SPRING: 4, SUMMER: 7, FALL: 11 };

export function startOfDay(date: Date | string): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function endOfDay(date: Date | string): Date {
  const day = new Date(date);
  day.setHours(23, 59, 59, 999);
  return day;
}

/** Semester number of a batch (by intake year) in a term; null without a year. */
export function computeStudentSemester(
  batchYear: number | null | undefined,
  semester: string,
  year: number,
): number | null {
  if (batchYear == null || Number.isNaN(batchYear)) {
    return null;
  }
  const diff = year - batchYear;
  return semester === "FALL" ? 2 * diff + 1 : 2 * diff;
}

/** A registration for `semester` opened today is for this year, unless its window has passed. */
export function computeRegistrationYear(semester: Semester, now = new Date()): number {
  const year = now.getFullYear();
  const windowEnd = new Date(year, SEMESTER_END_MONTH[semester] + 1, 0, 23, 59, 59, 999);
  return now > windowEnd ? year + 1 : year;
}

/** The calendar term a date falls in, by the fixed month windows. */
export function termOn(now = new Date()): Term {
  const month = now.getMonth();
  return {
    semester: month <= 4 ? "SPRING" : month <= 7 ? "SUMMER" : "FALL",
    year: now.getFullYear(),
  };
}

/** Registrations open for enrollment at `now`: inside their window and not ended early. */
export function openRegistrationWhere(now = new Date()): Prisma.RegistrationWhereInput {
  return { startDate: { lte: now }, endDate: { gte: startOfDay(now) }, closedAt: null };
}

/**
 * The term a date falls in: the semester period an admin set on a
 * registration when one covers the date, else the fixed month windows.
 */
export async function getTermOn(now = new Date()): Promise<Term> {
  const registration = await prisma.registration.findFirst({
    where: { semesterStart: { lte: now }, semesterEnd: { gte: startOfDay(now) }, semesterEndedAt: null },
    orderBy: { semesterStart: "desc" },
  });
  return registration
    ? { semester: registration.semester as Semester, year: registration.year }
    : termOn(now);
}

/** A programme's diplomas in semester order. */
export function getProgrammeDiplomas(programme: string) {
  return prisma.department.findMany({
    where: { category: programme },
    orderBy: [{ semester: "asc" }, { id: "asc" }],
  });
}

/** The diploma a batch studies in a term, or null before it starts / after it finishes. */
export function diplomaForTerm<T extends Pick<Department, "semester">>(
  diplomas: T[],
  batchYear: number | null | undefined,
  term: Term,
): T | null {
  const semester = computeStudentSemester(batchYear, term.semester, term.year);
  return diplomas.find((diploma) => diploma.semester === semester) ?? null;
}

/**
 * The diploma to show as a student's current one: the one for the current
 * term, held at the first before the batch starts and at the last after it
 * finishes, so every student counts towards exactly one diploma.
 */
export function currentDiploma<T extends Pick<Department, "semester">>(
  diplomas: T[] | undefined,
  batchYear: number | null | undefined,
  term: Term,
): T | null {
  if (!diplomas || diplomas.length === 0) {
    return null;
  }
  const semester = computeStudentSemester(batchYear, term.semester, term.year);
  if (semester == null || semester < diplomas[0].semester) {
    return diplomas[0];
  }
  return diplomas.findLast((diploma) => diploma.semester <= semester) ?? null;
}

/** Adds `currentDiploma` to each student, loading each programme's diplomas once. */
export async function withCurrentDiplomas<S extends { programme: string; batch: string }>(
  students: S[],
  now = new Date(),
) {
  const programmes = [...new Set(students.map((student) => student.programme))];
  const [term, batchYears, diplomasByProgramme] = await Promise.all([
    getTermOn(now),
    getBatchYears(),
    Promise.all(
      programmes.map(async (programme) => [programme, await getProgrammeDiplomas(programme)] as const),
    ).then((entries) => new Map(entries)),
  ]);
  return students.map((student) => ({
    ...student,
    currentDiploma: currentDiploma(
      diplomasByProgramme.get(student.programme),
      batchYears.get(student.batch) ?? null,
      term,
    ),
  }));
}
