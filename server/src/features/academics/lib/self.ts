import { HttpError } from "@/http/errors";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in user's own teacher/student profile, for the self-service
 * ("my ...") endpoints. Linked by user id.
 */
export async function getSelfStudent(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: { enrolledSections: true },
  });
  if (!student) {
    throw new HttpError(
      404,
      "No student profile is linked to your account yet. Contact an administrator.",
      "NO_PROFILE",
    );
  }
  return student;
}

export async function getSelfTeacher(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    throw new HttpError(
      404,
      "No teacher profile is linked to your account yet. Contact an administrator.",
      "NO_PROFILE",
    );
  }
  return teacher;
}

/**
 * The offering (course in a section), checked that the user may teach it: an
 * admin, or the teacher assigned to it. Used by attendance, marks and grades.
 */
export async function assertTeachesOffering(
  user: { id: string; role: string },
  sectionId: number,
  courseId: number,
) {
  const offering = await prisma.sectionCourse.findUnique({
    where: { sectionId_courseId: { sectionId, courseId } },
    include: {
      teacher: { select: { userId: true, name: true } },
      course: { select: { id: true, code: true, name: true, creditHours: true } },
      section: { select: { id: true, label: true, batch: true, department: { select: { code: true, name: true } } } },
      classroom: { select: { id: true } },
    },
  });
  if (!offering || (user.role !== "ADMIN" && offering.teacher?.userId !== user.id)) {
    throw new HttpError(404, "You are not assigned to teach this section.", "NOT_FOUND");
  }
  return offering;
}
