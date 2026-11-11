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
