import type { PrismaClient } from "@/generated/prisma/client";

import { type GradeRange, gradeFor, loadGradesByKey } from "./grading";

export interface MarkItem {
  categoryId?: number;
  obtained: number | null;
  total: number;
  /** The item's own share of the course percentage, inside its category's weightage. */
  weightage?: number | null;
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
 * Weighted percentage. An item with its own weightage counts by it; a
 * category's other items share what its weightage has left over, pooled by
 * marks (with no item weightages that is the whole category, as before). The
 * course percentage is the weighted average of everything graded, so ungraded
 * work and unallocated weight are left out (remaining weights rescaled).
 */
function weightedPercentage(items: MarkItem[], weights: Map<number, number>): number | null {
  const allocated = new Map<number, number>();
  for (const item of items) {
    if (item.weightage != null) allocated.set(item.categoryId!, (allocated.get(item.categoryId!) ?? 0) + item.weightage);
  }
  const parts: { weight: number; obtained: number; total: number }[] = [];
  const pooled = new Map<number, { obtained: number; total: number }>();
  for (const item of items) {
    if (item.obtained === null) continue;
    if (item.weightage != null) {
      parts.push({ weight: item.weightage, obtained: item.obtained, total: item.total });
      continue;
    }
    const entry = pooled.get(item.categoryId!) ?? { obtained: 0, total: 0 };
    entry.obtained += item.obtained;
    entry.total += item.total;
    pooled.set(item.categoryId!, entry);
  }
  for (const [categoryId, entry] of pooled) {
    parts.push({ weight: (weights.get(categoryId) ?? 0) - (allocated.get(categoryId) ?? 0), ...entry });
  }
  let weighted = 0;
  let weightUsed = 0;
  for (const part of parts) {
    if (part.weight <= 0 || !part.total) continue;
    weighted += part.weight * (part.obtained / part.total);
    weightUsed += part.weight;
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
  const computedPercentage = weights ? weightedPercentage(items, weights) : total ? Math.round((obtained / total) * 100) : null;
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
        c.assessments.map((a) => ({
          categoryId: c.id,
          obtained: obtainedBy.get(a.id) ?? null,
          total: a.totalMarks,
          weightage: a.weightage,
        })),
      );
      return [
        e.id,
        summarizeMarks(items, e.percentageOverride, gradesFor(e.courseId, e.sectionId), e.gradeOverride, weightsFor(own)),
      ];
    }),
  );
}
