import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Course assessment schemes: an admin defines a course's assessment sections
 * (Quizzes, Mid Term, Lab Work...) once, each theory or practical with a
 * weightage. Every section offered the course gets one marks category per
 * scheme entry, carrying its weightage.
 *
 * An entry's `type` is its name; these built-in codes have labels (QUIZ ->
 * Quizzes) and sort first, in this order.
 */
export const CATEGORY_TYPES = ["QUIZ", "ASSIGNMENT", "MID", "PROJECT", "LAB", "PRACTICAL", "FINAL"];
export const COMPONENTS = ["THEORY", "PRACTICAL"] as const;

const rank = (type: string) => {
  const index = CATEGORY_TYPES.indexOf(type);
  return index === -1 ? CATEGORY_TYPES.length : index;
};
export const compareTypes = (a: string, b: string) => rank(a) - rank(b);

const fmt = (n: number) => `${Math.round(n * 100) / 100}%`;
const sum = (entries: { weightage: number }[]) => entries.reduce((s, e) => s + e.weightage, 0);
const isClose = (a: number, b: number) => Math.abs(a - b) < 0.001;

/**
 * Why a scheme is invalid, or null. Theory entries can't total more than
 * theoryPercent, practical ones more than the rest; below 100% is allowed.
 */
export function validateScheme(
  entries: { type: string; component: string; weightage: number }[],
  theoryPercent: number,
): string | null {
  if (entries.length === 0) {
    return null;
  }
  const names = new Set<string>();
  for (const entry of entries) {
    const key = entry.type.toLowerCase();
    if (names.has(key)) return "Each assessment name can only be used once in a course.";
    names.add(key);
  }
  const practicalPercent = 100 - theoryPercent;
  if (practicalPercent === 0 && entries.some((e) => e.component === "PRACTICAL")) {
    return "This course has no practical share, so it can't have practical assessments.";
  }
  if (theoryPercent === 0 && entries.some((e) => e.component === "THEORY")) {
    return "This course has no theory share, so it can't have theory assessments.";
  }
  const theory = sum(entries.filter((e) => e.component === "THEORY"));
  const practical = sum(entries.filter((e) => e.component === "PRACTICAL"));
  if (theory > theoryPercent && !isClose(theory, theoryPercent)) {
    return `Theory assessments can't total more than ${fmt(theoryPercent)} (currently ${fmt(theory)}).`;
  }
  if (practical > practicalPercent && !isClose(practical, practicalPercent)) {
    return `Practical assessments can't total more than ${fmt(practicalPercent)} (currently ${fmt(practical)}).`;
  }
  return null;
}

/**
 * Makes one course+section's marks categories match the course scheme: one
 * category per entry (adopting a pre-scheme one of the same type), with its
 * weightage. A leftover category is deleted when empty, else kept at weight 0
 * so its marks stay visible but don't count. Returns whether anything changed.
 */
export async function syncSectionCategories(prisma: PrismaClient, courseId: number, sectionId: number) {
  const scheme = await prisma.courseAssessment.findMany({ where: { courseId } });
  if (scheme.length === 0) {
    return false;
  }
  const categories = await prisma.assessmentCategory.findMany({
    where: { courseId, sectionId },
    include: { _count: { select: { assessments: true } } },
  });
  const ops = [];
  for (const entry of scheme) {
    const existing =
      categories.find((c) => c.courseAssessmentId === entry.id) ?? categories.find((c) => c.type === entry.type);
    if (!existing) {
      ops.push(
        prisma.assessmentCategory.create({
          data: { courseId, sectionId, type: entry.type, weightage: entry.weightage, courseAssessmentId: entry.id },
        }),
      );
    } else if (existing.courseAssessmentId !== entry.id || existing.weightage !== entry.weightage) {
      ops.push(
        prisma.assessmentCategory.update({
          where: { id: existing.id },
          data: { weightage: entry.weightage, courseAssessmentId: entry.id },
        }),
      );
    }
  }
  const schemeTypes = new Set(scheme.map((e) => e.type));
  for (const category of categories.filter((c) => !schemeTypes.has(c.type))) {
    if (category._count.assessments === 0) {
      ops.push(prisma.assessmentCategory.delete({ where: { id: category.id } }));
    } else if (category.weightage !== 0) {
      ops.push(prisma.assessmentCategory.update({ where: { id: category.id }, data: { weightage: 0 } }));
    }
  }
  if (ops.length) {
    await prisma.$transaction(ops);
  }
  return ops.length > 0;
}

/** syncSectionCategories for every section offered the course. */
export async function syncCourseCategories(prisma: PrismaClient, courseId: number) {
  const links = await prisma.sectionCourse.findMany({ where: { courseId }, select: { sectionId: true } });
  for (const { sectionId } of links) {
    await syncSectionCategories(prisma, courseId, sectionId);
  }
}
