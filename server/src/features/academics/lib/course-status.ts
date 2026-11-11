import { courseTotalFee } from "./fee";

type CourseLike = {
  fee: number;
  extraFees?: { amount: number }[];
  sectionLinks?: unknown[];
  _count?: { sectionLinks?: number };
};

/**
 * A course is ACTIVE while it's offered to at least one section, otherwise
 * INACTIVE. Needs `_count.sectionLinks` or `sectionLinks` on the course.
 * Adds `totalFee` (fee plus extra fees) when extra fees were loaded.
 */
export function withCourseStatus<T extends CourseLike>(course: T) {
  const { _count, ...rest } = course;
  const offeredCount = course.sectionLinks?.length ?? _count?.sectionLinks ?? 0;
  return {
    ...rest,
    status: offeredCount > 0 ? ("ACTIVE" as const) : ("INACTIVE" as const),
    ...(course.extraFees ? { totalFee: courseTotalFee(course) } : {}),
  };
}
