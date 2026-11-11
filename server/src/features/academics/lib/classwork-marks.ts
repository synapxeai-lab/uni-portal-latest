import { SubmissionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Classwork grades feeding the marks sheet. A marks item ("Quiz 1") can be
 * linked to one assignment in the offering's classroom; each returned grade
 * is copied in as a mark, scaled from the assignment's points to the item's
 * total. Only returned grades count: that's when the student sees them and
 * the grade is locked.
 */

const scale = (grade: number, points: number, totalMarks: number) => Math.round((grade / points) * totalMarks * 100) / 100;

/** Copies every returned grade of the linked assignment into the item's marks. */
export async function importAssignmentMarks(assessmentId: number) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { category: { select: { courseId: true, sectionId: true } }, assignment: { select: { id: true, points: true } } },
  });
  if (!assessment?.assignment?.points) return;
  const { points, id: assignmentId } = assessment.assignment;
  const [submissions, enrollments] = await Promise.all([
    prisma.submission.findMany({
      where: { assignmentId, deletedAt: null, status: SubmissionStatus.RETURNED, grade: { not: null } },
      select: { studentId: true, grade: true },
    }),
    prisma.enrollment.findMany({
      where: { courseId: assessment.category.courseId, sectionId: assessment.category.sectionId, student: { userId: { not: null } } },
      select: { id: true, student: { select: { userId: true } } },
    }),
  ]);
  const enrollmentByUser = new Map(enrollments.map((e) => [e.student.userId!, e.id]));
  const rows = submissions.flatMap((s) => {
    const enrollmentId = enrollmentByUser.get(s.studentId);
    return enrollmentId ? [{ enrollmentId, obtained: scale(s.grade!, points, assessment.totalMarks) }] : [];
  });
  await prisma.$transaction(
    rows.map((r) =>
      prisma.mark.upsert({
        where: { assessmentId_enrollmentId: { assessmentId, enrollmentId: r.enrollmentId } },
        update: { obtained: r.obtained },
        create: { assessmentId, enrollmentId: r.enrollmentId, obtained: r.obtained },
      }),
    ),
  );
}

/** After a submission is returned: copies its grade into the linked marks item, if any. Returns whether a mark changed. */
export async function copyReturnedGrade(assignmentId: string, studentUserId: string): Promise<boolean> {
  const assessment = await prisma.assessment.findUnique({
    where: { assignmentId },
    include: { category: { select: { courseId: true, sectionId: true } }, assignment: { select: { points: true } } },
  });
  if (!assessment?.assignment?.points) return false;
  const [submission, enrollment] = await Promise.all([
    prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: studentUserId } } }),
    prisma.enrollment.findFirst({
      where: { courseId: assessment.category.courseId, sectionId: assessment.category.sectionId, student: { userId: studentUserId } },
      select: { id: true },
    }),
  ]);
  if (!enrollment || submission?.grade == null || submission.deletedAt) return false;
  const obtained = scale(submission.grade, assessment.assignment.points, assessment.totalMarks);
  await prisma.mark.upsert({
    where: { assessmentId_enrollmentId: { assessmentId: assessment.id, enrollmentId: enrollment.id } },
    update: { obtained },
    create: { assessmentId: assessment.id, enrollmentId: enrollment.id, obtained },
  });
  return true;
}
