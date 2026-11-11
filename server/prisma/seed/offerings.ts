import {
  AnnouncementStatus,
  AssignmentStatus,
  MaterialType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { syncAllOfferingClassrooms } from "@/features/academics/lib/offering-classrooms";
import { assignTeacher, offerDiplomaToBatch } from "@/features/academics/services/offering-service";

/**
 * Offers the Tourism diplomas to batch 2026 and assigns the seed teachers;
 * each offering gets its classroom. The DTM classes get some stream and
 * classwork content so the classroom pages have something to show.
 */
const TEACHING: Record<string, { A: string; B: string }> = {
  "DTM-TDW": { A: "ayesha.khan@eithm.edu.pk", B: "bilal.ahmed@eithm.edu.pk" },
  "DTM-TOM": { A: "ayesha.khan@eithm.edu.pk", B: "ayesha.khan@eithm.edu.pk" },
  "DTM-CCT": { A: "bilal.ahmed@eithm.edu.pk", B: "bilal.ahmed@eithm.edu.pk" },
  "DTM-TMK": { A: "sana.mirza@eithm.edu.pk", B: "sana.mirza@eithm.edu.pk" },
};

export async function seedOfferings(prisma: PrismaClient) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@eithm.edu.pk" } });
  const dtm = await prisma.department.findUniqueOrThrow({ where: { code: "DTM" } });
  await offerDiplomaToBatch(dtm.id, "2026", admin.id);

  const sections = await prisma.section.findMany({ where: { departmentId: dtm.id, batch: "2026" } });
  const courses = await prisma.course.findMany({ where: { departmentId: dtm.id } });
  for (const course of courses) {
    for (const section of sections) {
      const email = TEACHING[course.code]?.[section.label as "A" | "B"];
      const teacher = email ? await prisma.teacher.findUnique({ where: { email } }) : null;
      const offering = await prisma.sectionCourse.findUnique({
        where: { sectionId_courseId: { sectionId: section.id, courseId: course.id } },
      });
      if (teacher && offering && offering.teacherId === null) {
        await assignTeacher(section.id, course.id, teacher.id, admin.id);
      }
    }
  }
  const classroomIds = await syncAllOfferingClassrooms(admin.id);
  await seedClasswork(prisma);
  return { classrooms: classroomIds.length };
}

/** Demo content in the Tourist Destinations classes (only when they're empty). */
async function seedClasswork(prisma: PrismaClient) {
  const classrooms = await prisma.classroom.findMany({
    where: { subject: "DTM-TDW", offeringKey: { not: null } },
    include: { _count: { select: { announcements: true, assignments: true } } },
  });
  for (const classroom of classrooms) {
    if (classroom._count.announcements || classroom._count.assignments) {
      continue;
    }
    const authorId = classroom.ownerId;
    const topic = await prisma.topic.create({
      data: { classroomId: classroom.id, title: "Week 1: Introduction to world tourism", position: 1 },
    });
    await prisma.announcement.create({
      data: {
        classroomId: classroom.id,
        authorId,
        title: "Welcome to Tourist Destinations of the World",
        content:
          "Welcome to the course! Read the week 1 notes before our first class and bring a destination you'd like to present.",
        status: AnnouncementStatus.PUBLISHED,
        publishedAt: new Date(),
        isPinned: true,
      },
    });
    await prisma.material.create({
      data: {
        classroomId: classroom.id,
        topicId: topic.id,
        authorId,
        title: "UNWTO tourism highlights",
        description: "Global tourism trends - skim the regional sections.",
        url: "https://www.unwto.org/tourism-data",
        type: MaterialType.LINK,
        publishedAt: new Date(),
      },
    });
    await prisma.assignment.create({
      data: {
        classroomId: classroom.id,
        topicId: topic.id,
        authorId,
        title: "Destination profile",
        description: "Write a one-page profile of a destination: attractions, access, seasonality and target visitors.",
        status: AssignmentStatus.PUBLISHED,
        publishedAt: new Date(),
        points: 20,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
