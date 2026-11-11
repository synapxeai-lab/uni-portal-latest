import type { PrismaClient } from "@/generated/prisma/client";

import { type GradeRange, gradeFor, loadGradesByKey } from "./grading";

export interface MarkItem {
  categoryId?: number;
  obtained: number | null;
  total: number;
}

/**
 * Category weightages for one course+section (categoryId -> weightage), or
 * null when weighting doesn't apply yet: a category has none, or they don't
 * total 100.
 */
export function weightsFor(categories: { id: number; weightage: number | null }[]): Map<number, number> | null {
  if (categories.length === 0 || categories.some((c) => c.weightage === null || c.weightage === undefined)) {
    return null;
  }
  const total = categories.reduce((sum, c) => sum + c.weightage!, 0);
  if (Math.abs(total - 100) > 0.001) {
    return null;
  }
  return new Map(categories.map((c) => [c.id, c.weightage!]));
}

/**
 * Weighted percentage: each category's graded marks give its own percentage,
 * and the course percentage is their weighted average. Categories with nothing
 * graded yet are left out (remaining weights rescaled).
 */
function weightedPercentage(graded: MarkItem[], weights: Map<number, number>): number | null {
  const byCategory = new Map<number, { obtained: number; total: number }>();
  for (const mark of graded) {
    const entry = byCategory.get(mark.categoryId!) ?? { obtained: 0, total: 0 };
    entry.obtained += mark.obtained!;
    entry.total += mark.total;
    byCategory.set(mark.categoryId!, entry);
  }
  let weighted = 0;
  let weightUsed = 0;
  for (const [categoryId, entry] of byCategory) {
    const weight = weights.get(categoryId);
    if (!weight || !entry.total) continue;
    weighted += weight * (entry.obtained / entry.total);
    weightUsed += weight;
  }
  return weightUsed ? Math.round((weighted / weightUsed) * 100) : null;
}

/**
 * Course total for one student. Only graded items count, so an ungraded quiz
 * doesn't drag the percentage down. With weights the percentage is weighted by
 * category, else obtained/total. An admin percentage override replaces the
 * computed one (which is still reported); the letter grade follows the final
 * percentage unless a grade override is set.
 */
export function summarizeMarks(
  items: MarkItem[],
  percentageOverride: number | null = null,
  grades?: GradeRange[],
  gradeOverride: string | null = null,
  weights: Map<number, number> | null = null,
) {
  const graded = items.filter((m) => m.obtained !== null);
  const obtained = graded.reduce((sum, m) => sum + m.obtained!, 0);
  const total = graded.reduce((sum, m) => sum + m.total, 0);
  const computedPercentage = weights ? weightedPercentage(graded, weights) : total ? Math.round((obtained / total) * 100) : null;
  const adjusted = percentageOverride !== null && percentageOverride !== undefined;
  const percentage = adjusted ? percentageOverride : computedPercentage;
  const computedGrade = gradeFor(percentage, grades);
  const gradeAdjusted = Boolean(gradeOverride);
  return {
    obtained,
    total,
    weighted: Boolean(weights),
    computedPercentage,
    adjusted,
    percentage,
    computedGrade,
    gradeAdjusted,
    grade: gradeAdjusted ? gradeOverride : computedGrade,
  };
}

export type MarksSummary = ReturnType<typeof summarizeMarks>;

/** Summaries for many enrollments (each with `marks`), keyed by enrollment id - two queries in total. */
export async function summarizeEnrollments(
  prisma: PrismaClient,
  enrollments: {
    id: number;
    courseId: number;
    sectionId: number;
    percentageOverride: number | null;
    gradeOverride: string | null;
    marks: { assessmentId: number; obtained: number }[];
  }[],
) {
  if (enrollments.length === 0) {
    return new Map<number, MarksSummary>();
  }
  const pairs = enrollments.map((e) => ({ courseId: e.courseId, sectionId: e.sectionId }));
  const [categories, gradesFor] = await Promise.all([
    prisma.assessmentCategory.findMany({ where: { OR: pairs }, include: { assessments: true } }),
    loadGradesByKey(prisma, pairs),
  ]);
  return new Map(
    enrollments.map((e) => {
      const obtainedBy = new Map(e.marks.map((m) => [m.assessmentId, m.obtained]));
      const own = categories.filter((c) => c.courseId === e.courseId && c.sectionId === e.sectionId);
      const items = own.flatMap((c) =>
        c.assessments.map((a) => ({ categoryId: c.id, obtained: obtainedBy.get(a.id) ?? null, total: a.totalMarks })),
      );
      return [
        e.id,
        summarizeMarks(items, e.percentageOverride, gradesFor(e.courseId, e.sectionId), e.gradeOverride, weightsFor(own)),
      ];
    }),
  );
}
