import type { PrismaClient } from "@/generated/prisma/client";
import { syncCourseCategories } from "@/features/academics/lib/assessment-scheme";

/**
 * Assessment schemes for the DTM courses, and some graded work in Tourist
 * Destinations of the World (two quizzes and the mid term) so the marks pages
 * have numbers. Only fills what isn't there yet.
 */
const THEORY_SCHEME = [
  { type: "QUIZ", component: "THEORY", weightage: 15 },
  { type: "ASSIGNMENT", component: "THEORY", weightage: 15 },
  { type: "MID", component: "THEORY", weightage: 30 },
  { type: "FINAL", component: "THEORY", weightage: 40 },
];
const MIXED_SCHEME = [
  { type: "QUIZ", component: "THEORY", weightage: 10 },
  { type: "MID", component: "THEORY", weightage: 20 },
  { type: "FINAL", component: "THEORY", weightage: 30 },
  { type: "Role Play", component: "PRACTICAL", weightage: 40 },
];

export async function seedMarks(prisma: PrismaClient) {
  const courses = await prisma.course.findMany({
    where: { department: { code: "DTM" } },
    include: { _count: { select: { assessmentScheme: true } } },
  });
  for (const course of courses) {
    if (course._count.assessmentScheme > 0) continue;
    const scheme = course.theoryPercent === 100 ? THEORY_SCHEME : MIXED_SCHEME;
    await prisma.courseAssessment.createMany({ data: scheme.map((entry) => ({ ...entry, courseId: course.id })) });
    await syncCourseCategories(prisma, course.id);
  }

  const tdw = courses.find((c) => c.code === "DTM-TDW");
  if (!tdw) return 0;
  let marked = 0;
  const categories = await prisma.assessmentCategory.findMany({
    where: { courseId: tdw.id, type: { in: ["QUIZ", "MID"] } },
    include: { _count: { select: { assessments: true } } },
  });
  for (const category of categories) {
    if (category._count.assessments > 0) continue;
    const items =
      category.type === "QUIZ"
        ? [
            { title: "Quiz 1", totalMarks: 10 },
            { title: "Quiz 2", totalMarks: 10 },
          ]
        : [{ title: "Mid Term", totalMarks: 50 }];
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: tdw.id, sectionId: category.sectionId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const item of items) {
      const assessment = await prisma.assessment.create({ data: { categoryId: category.id, ...item } });
      await prisma.mark.createMany({
        data: enrollments.map((e, i) => ({
          assessmentId: assessment.id,
          enrollmentId: e.id,
          // A spread of results: 60% to 95% of the total.
          obtained: Math.round(item.totalMarks * (0.6 + ((i * 7 + item.totalMarks) % 8) * 0.05)),
        })),
      });
      marked += enrollments.length;
    }
  }
  return marked;
}
