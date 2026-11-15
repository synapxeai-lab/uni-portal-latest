import { SubmissionStatus } from "@/generated/prisma/enums";
import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { compareTypes, syncSectionCategories } from "./assessment-scheme";
import { assertItemWeightage, nextItemTitle, SINGLE_TITLE } from "./assessment-items";
import { conflictError } from "./http";

/**
 * Classwork grades feeding the marks sheet. A marks item ("Quiz 1") can be
 * linked to one assignment in the offering's classroom; each graded
 * submission is copied in as a mark, scaled from the assignment's points to
 * the item's total. Grading is final (the student sees it straight away);
 * work returned for revision has no grade, so its mark is removed until it's
 * graded again.
 *
 * Digital assessments start in the classroom: when a teacher gives graded
 * classwork a marks category (Quizzes, Assignments, Mid Term...), its item is
 * created on the section's marksheet and kept in step with the assignment.
 * Physical ones are still added on the Marks page.
 */

/** Where an assignment goes on the marksheet: a category of the course scheme and the item's weightage. */
export interface ClassworkPlacement {
  category: string;
  weightage: number | null;
}

async function offeringOf(classroomId: string) {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { sectionCourse: { select: { sectionId: true, courseId: true } } },
  });
  return classroom?.sectionCourse ?? null;
}

/**
 * The marks categories a classroom's graded work can go in (null when the
 * classroom isn't a course section's): each with its weightage, the item
 * weightage already given out and how many items it has. Read-only - the
 * section's categories are only created once work is actually placed.
 */
export async function classworkMarksCategories(classroomId: string) {
  const offering = await offeringOf(classroomId);
  if (!offering) return null;
  const { courseId, sectionId } = offering;
  const [scheme, categories] = await Promise.all([
    prisma.courseAssessment.findMany({ where: { courseId }, select: { type: true, weightage: true } }),
    prisma.assessmentCategory.findMany({
      where: { courseId, sectionId },
      select: { type: true, weightage: true, assessments: { select: { weightage: true } } },
    }),
  ]);
  const byType = new Map(categories.map((c) => [c.type, c]));
  // Pre-scheme courses keep the categories they already have.
  const source = scheme.length ? scheme : categories.filter((c) => c.weightage !== 0);
  return source
    .map((entry) => {
      const items = byType.get(entry.type)?.assessments ?? [];
      return {
        type: entry.type,
        weightage: entry.weightage,
        allocated: items.reduce((sum, a) => sum + (a.weightage ?? 0), 0),
        items: items.length,
        singleAssessment: Boolean(SINGLE_TITLE[entry.type]),
      };
    })
    .sort((a, b) => compareTypes(a.type, b.type));
}

/** The section's category of that type, created from the course scheme if it isn't there yet. */
async function resolveCategory(classroomId: string, type: string) {
  const offering = await offeringOf(classroomId);
  if (!offering) {
    throw badRequest("This class isn't a course section's classroom, so its work can't go on a marksheet.");
  }
  const { courseId, sectionId } = offering;
  await syncSectionCategories(prisma, courseId, sectionId);
  const category = await prisma.assessmentCategory.findUnique({ where: { courseId_sectionId_type: { courseId, sectionId, type } } });
  if (!category) throw badRequest("Pick a marks category from this course's assessment scheme.");
  return category;
}

/**
 * Checks a placement before the assignment is saved: the category exists, a
 * single exam (Mid Term) isn't on the marksheet already, and the weightage
 * fits in what the category has left.
 */
export async function assertClassworkPlacement(classroomId: string, placement: ClassworkPlacement | null | undefined, assignmentId?: string) {
  if (!placement) return;
  const category = await resolveCategory(classroomId, placement.category);
  const existing = assignmentId ? await prisma.assessment.findUnique({ where: { assignmentId }, select: { id: true, categoryId: true } }) : null;
  const sameCategory = existing?.categoryId === category.id;
  if (SINGLE_TITLE[category.type] && !sameCategory && (await prisma.assessment.count({ where: { categoryId: category.id } }))) {
    throw conflictError(`${SINGLE_TITLE[category.type]} is already on the marksheet.`);
  }
  await assertItemWeightage(prisma, category, placement.weightage, sameCategory ? existing!.id : undefined);
}

/**
 * After an assignment is saved or deleted, brings its marksheet item in line:
 * created in the picked category (totalling the assignment's points), moved
 * or re-weighted, re-scaled when the points change, and removed when it's
 * ungraded, deleted or given no category. `placement` undefined keeps where
 * it is. Returns whether the marksheet changed.
 */
export async function syncClassworkItem(
  assignmentId: string,
  placement: ClassworkPlacement | null | undefined,
  previousPoints: number | null = null,
): Promise<boolean> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      classroomId: true,
      points: true,
      deletedAt: true,
      assessment: { select: { id: true, categoryId: true, totalMarks: true } },
    },
  });
  if (!assignment) return false;
  const existing = assignment.assessment;
  if (!assignment.points || assignment.deletedAt || placement === null) {
    if (!existing) return false;
    await prisma.assessment.delete({ where: { id: existing.id } });
    return true;
  }
  // An item still totalling the old points follows the new ones; a total the teacher changed stays.
  const totalMarks = existing && existing.totalMarks === previousPoints ? assignment.points : existing?.totalMarks;
  if (placement === undefined) {
    if (!existing || previousPoints === assignment.points) return false;
    await prisma.assessment.update({ where: { id: existing.id }, data: { totalMarks } });
    await importAssignmentMarks(existing.id);
    return true;
  }
  const category = await resolveCategory(assignment.classroomId, placement.category);
  if (existing) {
    const moved = existing.categoryId !== category.id;
    await prisma.assessment.update({
      where: { id: existing.id },
      data: {
        weightage: placement.weightage,
        totalMarks,
        ...(moved ? { categoryId: category.id, title: await nextItemTitle(prisma, category) } : {}),
      },
    });
    await importAssignmentMarks(existing.id);
    return true;
  }
  const created = await prisma.assessment.create({
    data: {
      categoryId: category.id,
      title: await nextItemTitle(prisma, category),
      totalMarks: assignment.points,
      weightage: placement.weightage,
      assignmentId,
    },
  });
  await importAssignmentMarks(created.id);
  return true;
}

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
