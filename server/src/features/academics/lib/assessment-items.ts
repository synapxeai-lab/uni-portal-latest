import type { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/http/errors";

import { conflictError } from "./http";

type Db = Prisma.TransactionClient;

/**
 * Items of a marks category ("Quiz 1", "Mid Term"), whether entered on the
 * Marks page (physical work) or created from classroom classwork (digital).
 */

// Quizzes, assignments, projects and labs are numbered; mid, practical and final are single exams.
const TITLE_PREFIX: Record<string, string> = { QUIZ: "Quiz", ASSIGNMENT: "Assignment", PROJECT: "Project", LAB: "Lab" };
export const SINGLE_TITLE: Record<string, string> = { MID: "Mid Term", PRACTICAL: "Practical Exam", FINAL: "Final Term" };

// Same labels as the client's categoryLabel; custom scheme names show as typed.
const CATEGORY_LABELS: Record<string, string> = {
  QUIZ: "Quizzes",
  ASSIGNMENT: "Assignments",
  MID: "Mid Term",
  PROJECT: "Project",
  LAB: "Lab Work",
  PRACTICAL: "Practical",
  FINAL: "Final Term",
};
export const categoryLabel = (type: string) => CATEGORY_LABELS[type] ?? type;

const fmt = (n: number) => `${Math.round(n * 100) / 100}%`;

/** The next item's title in a category ("Quiz 3"), or its single exam ("Mid Term") if it has none yet. */
export async function nextItemTitle(db: Db, category: { id: number; type: string }): Promise<string> {
  const existing = await db.assessment.findMany({ where: { categoryId: category.id }, select: { title: true } });
  const single = SINGLE_TITLE[category.type];
  if (single) {
    if (existing.length > 0) throw conflictError(`${single} already exists.`);
    return single;
  }
  // After the highest number so deleting "Quiz 2" of three doesn't repeat "Quiz 3".
  const prefix = TITLE_PREFIX[category.type] ?? category.type;
  const numbers = existing.map((a) => Number.parseInt(a.title.slice(prefix.length + 1), 10)).filter((n) => !Number.isNaN(n));
  return `${prefix} ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
}

/** Item weightage already given out in a category, leaving out one item (the one being edited). */
export async function allocatedWeightage(db: Db, categoryId: number, exceptAssessmentId?: number): Promise<number> {
  const { _sum } = await db.assessment.aggregate({
    where: { categoryId, ...(exceptAssessmentId ? { id: { not: exceptAssessmentId } } : {}) },
    _sum: { weightage: true },
  });
  return _sum.weightage ?? 0;
}

/**
 * An item's weightage must fit in what its category has left: the items of
 * "Assignments 20%" can't total more than 20%. Totalling less is fine.
 */
export async function assertItemWeightage(
  db: Db,
  category: { id: number; type: string; weightage: number | null },
  weightage: number | null | undefined,
  exceptAssessmentId?: number,
) {
  if (weightage == null) return;
  const label = categoryLabel(category.type);
  if (!category.weightage) {
    throw badRequest(`${label} has no weightage in the course's assessment scheme, so its items can't carry one.`);
  }
  const taken = await allocatedWeightage(db, category.id, exceptAssessmentId);
  const left = Math.max(0, category.weightage - taken);
  if (weightage > left + 0.001) {
    throw badRequest(
      `${label} carries ${fmt(category.weightage)} and ${fmt(taken)} is already given to its other items, ` +
        `so this one can be at most ${fmt(left)}.`,
    );
  }
}
