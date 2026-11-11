import type { PrismaClient } from "@/generated/prisma/client";
import { syncChallan } from "@/features/academics/lib/challans";
import { syncAllOfferingClassrooms } from "@/features/academics/lib/offering-classrooms";
import { computeRegistrationYear } from "@/features/academics/lib/terms";

/**
 * Opens registration for this Fall (when none exists for it) and registers the
 * seed students in their section's DTM courses - which puts them in those
 * classrooms and gives them challans. Ali Raza leaves Tourism Marketing for
 * the registration page to offer.
 */
export async function seedRegistration(prisma: PrismaClient) {
  const year = computeRegistrationYear("FALL");
  const registration = await prisma.registration.upsert({
    where: { semester_year: { semester: "FALL", year } },
    update: {},
    create: {
      semester: "FALL",
      year,
      startDate: new Date(year, 9, 1),
      endDate: new Date(year, 11, 20),
      semesterStart: new Date(year, 8, 1),
      semesterEnd: new Date(year, 11, 31),
    },
  });

  const dtm = await prisma.department.findUniqueOrThrow({ where: { code: "DTM" } });
  const students = await prisma.student.findMany({
    where: { programme: "TOURISM", batch: "2026", email: { endsWith: "@eithm.edu.pk" } },
  });
  let enrolled = 0;
  for (const student of students) {
    const section = await prisma.section.findFirst({
      where: { departmentId: dtm.id, batch: "2026", label: student.section },
      include: { courseLinks: { include: { course: true } } },
    });
    if (!section) continue;
    for (const { course } of section.courseLinks) {
      if (student.email === "ali.raza@eithm.edu.pk" && course.code === "DTM-TMK") continue;
      const created = await prisma.enrollment.upsert({
        where: {
          studentId_registrationId_courseId: { studentId: student.id, registrationId: registration.id, courseId: course.id },
        },
        update: {},
        create: { studentId: student.id, registrationId: registration.id, courseId: course.id, sectionId: section.id },
      });
      if (created) enrolled += 1;
    }
    await syncChallan(student.id, registration.id);
  }
  await syncAllOfferingClassrooms();
  return { registration: `${registration.semester} ${registration.year}`, enrolled };
}
