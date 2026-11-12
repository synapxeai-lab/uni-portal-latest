import { SubmissionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Classwork grades feeding the marks sheet. A marks item ("Quiz 1") can be
 * linked to one assignment in the offering's classroom; each graded
 * submission is copied in as a mark, scaled from the assignment's points to
 * the item's total. Grading is final (the student sees it straight away);
 * work returned for revision has no grade, so its mark is removed until it's
 * graded again.
 */

const scale = (grade: number, points: number, totalMarks: number) => Math.round((grade / points) * totalMarks * 100) / 100;

/** Copies every graded submission of the linked assignment into the item's marks. */
export async function importAssignmentMarks(assessmentId: number) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { category: { select: { courseId: true, sectionId: true } }, assignment: { select: { id: true, points: true } } },
  });
  if (!assessment?.assignment?.points) return;
  const { points, id: assignmentId } = assessment.assignment;
  const [submissions, enrollments] = await Promise.all([
    prisma.submission.findMany({
      where: { assignmentId, deletedAt: null, status: SubmissionStatus.REVIEWED, grade: { not: null } },
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

/**
 * After a teacher grades or returns one student's work: brings their mark in
 * the linked marks item, if any, in line with it - the scaled grade when
 * graded, no mark otherwise. Returns whether the assignment is linked (so the
 * caller knows to refresh university data).
 */
export async function syncClassworkMark(assignmentId: string, studentUserId: string): Promise<boolean> {
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
  if (!enrollment) return false;
  const key = { assessmentId_enrollmentId: { assessmentId: assessment.id, enrollmentId: enrollment.id } };
  const graded = submission && !submission.deletedAt && submission.status === SubmissionStatus.REVIEWED && submission.grade !== null;
  if (!graded) {
    await prisma.mark.deleteMany({ where: { assessmentId: assessment.id, enrollmentId: enrollment.id } });
    return true;
  }
  const obtained = scale(submission.grade!, assessment.assignment.points, assessment.totalMarks);
  await prisma.mark.upsert({
    where: key,
    update: { obtained },
    create: { assessmentId: assessment.id, enrollmentId: enrollment.id, obtained },
  });
  return true;
}
