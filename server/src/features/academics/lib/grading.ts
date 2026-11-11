import type { PrismaClient } from "@/generated/prisma/client";

export interface GradeRange {
  grade: string;
  min: number;
  max: number;
}

/** Letter grades and their default ranges, highest first. Ranges can be moved per section; the set is fixed. */
export const DEFAULT_GRADES: GradeRange[] = [
  { grade: "A", min: 85, max: 100 },
  { grade: "A-", min: 80, max: 84 },
  { grade: "B+", min: 75, max: 79 },
  { grade: "B", min: 71, max: 74 },
  { grade: "B-", min: 68, max: 70 },
  { grade: "C+", min: 64, max: 67 },
  { grade: "C", min: 61, max: 63 },
  { grade: "C-", min: 58, max: 60 },
  { grade: "D+", min: 54, max: 57 },
  { grade: "D", min: 50, max: 53 },
  { grade: "F", min: 0, max: 49 },
];

export const GRADE_LETTERS = DEFAULT_GRADES.map((g) => g.grade) as [string, ...string[]];

/** HEC 4.0 scale. */
export const GRADE_POINTS: Record<string, number> = {
  A: 4.0, "A-": 3.67, "B+": 3.33, B: 3.0, "B-": 2.67, "C+": 2.33, C: 2.0, "C-": 1.67, "D+": 1.33, D: 1.0, F: 0.0,
};

/** Credit-hour weighted GPA over graded courses; null when none are graded. */
export function computeGpa(courses: { gradePoints: number | null; creditHours: number }[]): number | null {
  const graded = courses.filter((c) => c.gradePoints !== null);
  const credits = graded.reduce((sum, c) => sum + c.creditHours, 0);
  if (!credits) {
    return null;
  }
  const points = graded.reduce((sum, c) => sum + c.gradePoints! * c.creditHours, 0);
  return Math.round((points / credits) * 100) / 100;
}

/** Why grade ranges are invalid, or null: every grade in order, whole numbers covering 0-100 without gaps. */
export function validateGrades(grades: GradeRange[]): string | null {
  if (grades.length !== GRADE_LETTERS.length || grades.some((g, i) => g.grade !== GRADE_LETTERS[i])) {
    return "Grades must list every grade from A to F in order.";
  }
  for (const g of grades) {
    if (!Number.isInteger(g.min) || !Number.isInteger(g.max)) return `${g.grade}: percentages must be whole numbers.`;
    if (g.min < 0 || g.max > 100) return `${g.grade}: percentages must be between 0 and 100.`;
    if (g.min > g.max) return `${g.grade}: minimum can't be greater than maximum.`;
  }
  if (grades[0].max !== 100) return `${grades[0].grade} must go up to 100%.`;
  if (grades[grades.length - 1].min !== 0) return `${grades[grades.length - 1].grade} must start at 0%.`;
  for (let i = 1; i < grades.length; i += 1) {
    if (grades[i].max !== grades[i - 1].min - 1) {
      return `${grades[i].grade} must end right below where ${grades[i - 1].grade} starts (${grades[i - 1].min - 1}%).`;
    }
  }
  return null;
}

/** The highest grade whose minimum the percentage reaches (works for fractions, e.g. an override of 84.5). */
export function gradeFor(percentage: number | null | undefined, grades: GradeRange[] = DEFAULT_GRADES): string | null {
  if (percentage === null || percentage === undefined) {
    return null;
  }
  return (grades.find((g) => percentage >= g.min) ?? grades[grades.length - 1]).grade;
}

/** Grade ranges per "courseId-sectionId", defaulting when unset. */
export async function loadGradesByKey(prisma: PrismaClient, pairs: { courseId: number; sectionId: number }[]) {
  const rows = pairs.length === 0 ? [] : await prisma.gradingCriteria.findMany({ where: { OR: pairs } });
  const byKey = new Map(rows.map((r) => [`${r.courseId}-${r.sectionId}`, r.grades as unknown as GradeRange[]]));
  return (courseId: number, sectionId: number) => byKey.get(`${courseId}-${sectionId}`) ?? DEFAULT_GRADES;
}

/** The generated grade a student may see: null until generated and its visible-from date has come. */
export function visibleGrade(
  enrollment: { publishedGrade: string | null; gradeVisibleFrom: Date | null },
  now = new Date(),
): string | null {
  if (!enrollment.publishedGrade || !enrollment.gradeVisibleFrom) {
    return null;
  }
  return enrollment.gradeVisibleFrom <= now ? enrollment.publishedGrade : null;
}
