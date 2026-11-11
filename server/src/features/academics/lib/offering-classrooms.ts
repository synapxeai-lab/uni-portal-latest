import {
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/enums";
import { generateClassroomCode } from "@/features/classroom/lib/generate-code";
import { invalidateClassroom } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";

/**
 * The bridge between the University Portal's records and GCR's classrooms.
 *
 * Every course offered to a section (SectionCourse) has one classroom for its
 * stream, classwork and submissions:
 * - owned by the offering's teacher (or, until one is assigned, the admin who
 *   offered it); every admin is listed as a co-teacher, as on any classroom;
 * - its students are the ones registered for that course in that section,
 *   kept in step as they register and drop;
 * - when the course stops being offered the classroom is archived, and
 *   offering it again restores the same classroom (matched by offeringKey).
 *
 * The classroom's `section` is the cohort ("DTM 2026-A"), so the timetable's
 * one-class-per-section-per-slot rule applies across the cohort's courses.
 */

export const offeringKey = (sectionId: number, courseId: number) => `${sectionId}:${courseId}`;

const offeringInclude = {
  course: { select: { id: true, code: true, name: true, creditHours: true } },
  section: { include: { department: { select: { code: true, name: true } } } },
  teacher: { select: { userId: true } },
  classroom: { select: { id: true, ownerId: true, status: true } },
} as const;

async function firstAdminId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

/** Makes one offering's classroom exist and match the offering; returns its id. */
async function syncOne(sectionCourseId: number, actorId: string | null): Promise<string | null> {
  const offering = await prisma.sectionCourse.findUnique({
    where: { id: sectionCourseId },
    include: offeringInclude,
  });
  if (!offering) {
    return null;
  }
  const key = offeringKey(offering.sectionId, offering.courseId);
  const cohort = `${offering.section.department.code} ${offering.section.batch}-${offering.section.label}`;
  const teacherUserId = offering.teacher?.userId ?? null;

  let classroom =
    offering.classroom ??
    (await prisma.classroom.findUnique({
      where: { offeringKey: key },
      select: { id: true, ownerId: true, status: true },
    }));

  if (!classroom) {
    const ownerId = teacherUserId ?? actorId ?? (await firstAdminId());
    if (!ownerId) {
      return null; // no account at all to own it yet
    }
    const defaults = await getSystemSettings();
    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN, id: { not: ownerId } },
      select: { id: true },
    });
    for (let attempt = 0; attempt < 5 && !classroom; attempt += 1) {
      try {
        classroom = await prisma.classroom.create({
          data: {
            ownerId,
            title: offering.course.name,
            subject: offering.course.code,
            section: cohort,
            description: `${offering.course.code} · ${offering.course.creditHours} credit hours · ${offering.section.department.name}, batch ${offering.section.batch}, section ${offering.section.label}.`,
            code: generateClassroomCode(),
            sectionCourseId: offering.id,
            offeringKey: key,
            settings: {
              create: {
                allowComments: defaults.defaultAllowComments,
                allowMaterials: defaults.defaultAllowMaterials,
                allowAssignments: defaults.defaultAllowAssignments,
              },
            },
            memberships: {
              create: [
                { userId: ownerId, role: ClassroomMembershipRole.OWNER },
                ...admins.map((admin) => ({ userId: admin.id, role: ClassroomMembershipRole.CO_TEACHER })),
              ],
            },
          },
          select: { id: true, ownerId: true, status: true },
        });
      } catch (error) {
        // A classroom code collision - try another code.
        if ((error as { code?: string }).code !== "P2002") {
          throw error;
        }
      }
    }
    if (!classroom) {
      return null;
    }
  } else {
    await prisma.classroom.update({
      where: { id: classroom.id },
      data: {
        sectionCourseId: offering.id,
        offeringKey: key,
        section: cohort,
        // Offered again: bring the archived classroom back.
        ...(classroom.status === ClassroomStatus.ARCHIVED ? { status: ClassroomStatus.ACTIVE } : {}),
      },
    });
  }

  // The assigned teacher owns the classroom.
  if (teacherUserId && classroom.ownerId !== teacherUserId) {
    const previousOwner = await prisma.user.findUnique({
      where: { id: classroom.ownerId },
      select: { role: true },
    });
    await prisma.$transaction([
      prisma.classroom.update({ where: { id: classroom.id }, data: { ownerId: teacherUserId } }),
      prisma.classroomMembership.upsert({
        where: { classroomId_userId: { classroomId: classroom.id, userId: teacherUserId } },
        update: { role: ClassroomMembershipRole.OWNER, status: ClassroomMembershipStatus.ACTIVE },
        create: { classroomId: classroom.id, userId: teacherUserId, role: ClassroomMembershipRole.OWNER },
      }),
      // An admin stays as co-teacher; a replaced teacher leaves the class.
      prisma.classroomMembership.updateMany({
        where: { classroomId: classroom.id, userId: classroom.ownerId },
        data:
          previousOwner?.role === UserRole.ADMIN
            ? { role: ClassroomMembershipRole.CO_TEACHER }
            : { status: ClassroomMembershipStatus.REMOVED },
      }),
    ]);
  }

  await syncStudents(classroom.id, offering.courseId, offering.sectionId);
  return classroom.id;
}

/**
 * Registered students are active members; students (users with a student
 * profile, or whose account was archived with their profile) no longer
 * registered are removed. Members added by hand who aren't
 * university students (e.g. guests) are left alone.
 */
async function syncStudents(classroomId: string, courseId: number, sectionId: number) {
  const [enrollments, memberships] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, sectionId, student: { userId: { not: null } } },
      select: { student: { select: { userId: true } } },
    }),
    prisma.classroomMembership.findMany({
      where: { classroomId, role: ClassroomMembershipRole.STUDENT },
      select: {
        userId: true,
        status: true,
        user: { select: { status: true, studentProfile: { select: { id: true } } } },
      },
    }),
  ]);
  const registered = new Set(enrollments.map((e) => e.student.userId!));
  const byUser = new Map(memberships.map((m) => [m.userId, m]));

  const toActivate = [...registered].filter((userId) => byUser.get(userId)?.status !== ClassroomMembershipStatus.ACTIVE);
  const toRemove = memberships
    .filter(
      (m) =>
        m.status === ClassroomMembershipStatus.ACTIVE &&
        (m.user.studentProfile || m.user.status === UserStatus.ARCHIVED) &&
        !registered.has(m.userId),
    )
    .map((m) => m.userId);

  if (toActivate.length === 0 && toRemove.length === 0) {
    return;
  }
  await prisma.$transaction([
    ...toActivate.map((userId) =>
      prisma.classroomMembership.upsert({
        where: { classroomId_userId: { classroomId, userId } },
        update: { status: ClassroomMembershipStatus.ACTIVE },
        create: { classroomId, userId, role: ClassroomMembershipRole.STUDENT },
      }),
    ),
    ...(toRemove.length
      ? [
          prisma.classroomMembership.updateMany({
            where: { classroomId, userId: { in: toRemove } },
            data: { status: ClassroomMembershipStatus.REMOVED },
          }),
        ]
      : []),
  ]);
}

/** Brings the classrooms of these offerings in line with them. */
export async function syncOfferingClassrooms(sectionCourseIds: number[], actorId: string | null = null) {
  const classroomIds: string[] = [];
  for (const id of new Set(sectionCourseIds)) {
    const classroomId = await syncOne(id, actorId);
    if (classroomId) {
      classroomIds.push(classroomId);
    }
  }
  if (classroomIds.length) {
    invalidateClassroom(...classroomIds);
  }
  return classroomIds;
}

/** The offerings for these course+section pairs (e.g. after registrations change). */
export async function syncClassroomsFor(pairs: { courseId: number; sectionId: number }[], actorId: string | null = null) {
  if (pairs.length === 0) {
    return [];
  }
  const offerings = await prisma.sectionCourse.findMany({
    where: { OR: pairs.map(({ courseId, sectionId }) => ({ courseId, sectionId })) },
    select: { id: true },
  });
  return syncOfferingClassrooms(
    offerings.map((o) => o.id),
    actorId,
  );
}

/** Every offering - used after importing data and by the seed. */
export async function syncAllOfferingClassrooms(actorId: string | null = null) {
  const offerings = await prisma.sectionCourse.findMany({ select: { id: true } });
  return syncOfferingClassrooms(
    offerings.map((o) => o.id),
    actorId,
  );
}

/**
 * Archives the classrooms of offerings about to be removed (call before
 * deleting the SectionCourse rows). They keep their offeringKey for a re-offer.
 */
export async function archiveOfferingClassrooms(sectionCourseIds: number[]) {
  if (sectionCourseIds.length === 0) {
    return;
  }
  const classrooms = await prisma.classroom.findMany({
    where: { sectionCourseId: { in: sectionCourseIds } },
    select: { id: true },
  });
  if (classrooms.length === 0) {
    return;
  }
  await prisma.classroom.updateMany({
    where: { id: { in: classrooms.map((c) => c.id) }, status: ClassroomStatus.ACTIVE },
    data: { status: ClassroomStatus.ARCHIVED },
  });
  invalidateClassroom(...classrooms.map((c) => c.id));
}

/** Archives the classrooms of every offering matching `where` (before a cascading delete). */
export async function archiveOfferingsWhere(where: import("@/generated/prisma/client").Prisma.SectionCourseWhereInput) {
  const offerings = await prisma.sectionCourse.findMany({ where, select: { id: true } });
  await archiveOfferingClassrooms(offerings.map((o) => o.id));
}
