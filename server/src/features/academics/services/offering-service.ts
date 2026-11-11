import { z } from "zod";


import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { DEFAULT_SECTION_LABELS, getBatchDetails, isValidBatch } from "../lib/batches";
import { notFoundError } from "../lib/http";
import {
  archiveOfferingClassrooms,
  syncOfferingClassrooms,
} from "../lib/offering-classrooms";
import { syncStudentsForNewSection } from "../lib/section-sync";
import { diplomaForTerm, getTermOn, openRegistrationWhere, type Semester, type Term } from "../lib/terms";

export const offerSchema = z.object({
  departmentId: z.number().int("Diploma is required"),
  courseId: z.number().int("Course is required"),
  batch: z.string().min(1, "Batch is required"),
});

export const assignTeacherSchema = z.object({ teacherId: z.number().int().nullable() });

/** A diploma's sections for a batch, creating Sections A and B first when it has none. */
async function ensureBatchSections(departmentId: number, batch: string) {
  let sections = await prisma.section.findMany({ where: { departmentId, batch } });
  if (sections.length === 0) {
    await prisma.section.createMany({
      data: DEFAULT_SECTION_LABELS.map((label) => ({ departmentId, batch, label })),
      skipDuplicates: true,
    });
    sections = await prisma.section.findMany({ where: { departmentId, batch } });
    for (const section of sections) {
      await syncStudentsForNewSection(section);
    }
  }
  return sections;
}

/**
 * Offers courses to sections that don't have them yet (idempotent), bringing
 * along any teacher planned before the offering, and creates their
 * classrooms. Returns how many offerings were created.
 */
async function linkCourses(courseIds: number[], sectionIds: number[], actorId: string | null) {
  if (courseIds.length === 0 || sectionIds.length === 0) {
    return 0;
  }
  const where = { courseId: { in: courseIds }, sectionId: { in: sectionIds } };
  const { count } = await prisma.$transaction(async (tx) => {
    const planned = await tx.plannedAssignment.findMany({ where });
    const teacherFor = (courseId: number, sectionId: number) =>
      planned.find((p) => p.courseId === courseId && p.sectionId === sectionId)?.teacherId ?? null;
    const created = await tx.sectionCourse.createMany({
      data: courseIds.flatMap((courseId) =>
        sectionIds.map((sectionId) => ({ sectionId, courseId, teacherId: teacherFor(courseId, sectionId) })),
      ),
      skipDuplicates: true,
    });
    await tx.plannedAssignment.deleteMany({ where });
    return created;
  });
  if (count > 0) {
    const offerings = await prisma.sectionCourse.findMany({ where: { ...where, classroom: null }, select: { id: true } });
    await syncOfferingClassrooms(
      offerings.map((o) => o.id),
      actorId,
    );
  }
  return count;
}

/** Offers one course to every section of a batch in a diploma. */
export async function offerCourse(input: z.infer<typeof offerSchema>, actorId: string | null) {
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) {
    throw notFoundError("Diploma not found.");
  }
  // Any course of the programme can be offered to any of its diplomas.
  const course = await prisma.course.findUnique({ where: { id: input.courseId }, include: { department: true } });
  if (!course) {
    throw notFoundError("Course not found.");
  }
  if (course.department.category !== department.category) {
    throw badRequest("This course is not in the selected diploma's programme.");
  }
  const hasSections = await prisma.section.count({
    where: { departmentId: input.departmentId, batch: input.batch },
  });
  if (!hasSections && !(await isValidBatch(input.batch))) {
    throw badRequest("Select a valid batch.");
  }
  const sections = await ensureBatchSections(input.departmentId, input.batch);
  const count = await linkCourses(
    [input.courseId],
    sections.map((s) => s.id),
    actorId,
  );
  return {
    count,
    message:
      count > 0
        ? `${course.code} offered to ${count} of ${sections.length} section(s) in batch ${input.batch}.`
        : `${course.code} is already offered to every section in batch ${input.batch}.`,
  };
}

/**
 * Stops offering a course to a batch. Assigned teachers are kept as planned
 * assignments and the classrooms are archived, so offering it again restores
 * both.
 */
export async function unofferCourse(input: z.infer<typeof offerSchema>) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) {
    throw notFoundError("Course not found.");
  }
  const sections = await prisma.section.findMany({
    where: { departmentId: input.departmentId, batch: input.batch },
    select: { id: true },
  });
  if (sections.length === 0) {
    throw notFoundError(`No sections found for batch ${input.batch} in this diploma.`);
  }
  const where = { courseId: input.courseId, sectionId: { in: sections.map((s) => s.id) } };
  const offerings = await prisma.sectionCourse.findMany({ where });
  await archiveOfferingClassrooms(offerings.map((o) => o.id));
  const { count } = await prisma.$transaction(async (tx) => {
    const withTeacher = offerings.filter((o) => o.teacherId !== null);
    if (withTeacher.length) {
      await tx.plannedAssignment.createMany({
        data: withTeacher.map((o) => ({ sectionId: o.sectionId, courseId: o.courseId, teacherId: o.teacherId! })),
        skipDuplicates: true,
      });
    }
    return tx.sectionCourse.deleteMany({ where });
  });
  return {
    count,
    message:
      count > 0
        ? `${course.code} is no longer offered to batch ${input.batch}. Its classrooms were archived.`
        : `${course.code} was not offered to batch ${input.batch}.`,
  };
}

/**
 * Assigns (or with null, unassigns) a teacher to a course in a section. Before
 * the course is offered there, the teacher is only planned.
 */
export async function assignTeacher(
  sectionId: number,
  courseId: number,
  teacherId: number | null,
  actorId: string | null,
) {
  const [section, course] = await Promise.all([
    prisma.section.findUnique({ where: { id: sectionId }, include: { department: true } }),
    prisma.course.findUnique({ where: { id: courseId }, include: { department: true } }),
  ]);
  if (!section || !course) {
    throw notFoundError("Section or course not found.");
  }
  if (section.department.category !== course.department.category) {
    throw badRequest("This section is not in the course's programme.");
  }
  let teacher: { id: number; name: string; email: string } | null = null;
  if (teacherId !== null) {
    teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, email: true },
    });
    if (!teacher) {
      throw notFoundError("Teacher not found.");
    }
  }
  const key = { sectionId_courseId: { sectionId, courseId } };
  const offering = await prisma.sectionCourse.findUnique({ where: key });
  if (offering) {
    await prisma.sectionCourse.update({ where: key, data: { teacherId } });
    await syncOfferingClassrooms([offering.id], actorId);
  } else if (teacherId === null) {
    await prisma.plannedAssignment.deleteMany({ where: { sectionId, courseId } });
  } else {
    await prisma.plannedAssignment.upsert({
      where: key,
      update: { teacherId },
      create: { sectionId, courseId, teacherId },
    });
  }
  return {
    teacher,
    offered: Boolean(offering),
    message: teacherId
      ? offering
        ? `${teacher!.name} now teaches ${course.code} to section ${section.label} and owns its classroom.`
        : `${teacher!.name} will teach ${course.code} to section ${section.label} once it's offered.`
      : "Teacher unassigned.",
  };
}

/**
 * Every course with every section of its diploma (all batches), whether it's
 * offered there, and its teacher (assigned or planned) - the Assign Teachers
 * page. Courses whose diploma has no sections are left out.
 */
export async function listAssignments(params: { departmentId?: number; category?: string }) {
  const teacherSelect = { select: { id: true, name: true, email: true } };
  const courses = await prisma.course.findMany({
    where: {
      department: { sections: { some: {} }, ...(params.category ? { category: params.category } : {}) },
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    },
    include: {
      department: { include: { sections: { orderBy: [{ batch: "desc" }, { label: "asc" }] } } },
      sectionLinks: {
        include: {
          teacher: teacherSelect,
          classroom: { select: { id: true } },
          section: { include: { department: { select: { code: true } } } },
        },
      },
      plannedTeachers: { include: { teacher: teacherSelect } },
    },
    orderBy: [{ department: { semester: "asc" } }, { departmentId: "asc" }, { code: "asc" }],
  });
  return courses.map(({ department: { sections, ...department }, sectionLinks, plannedTeachers, ...course }) => ({
    ...course,
    department,
    rows: [
      ...sections,
      // Sections of another diploma this course is also offered to.
      ...sectionLinks.map((link) => link.section).filter((s) => s.departmentId !== course.departmentId),
    ].map((section) => {
      const link = sectionLinks.find((l) => l.sectionId === section.id);
      const planned = plannedTeachers.find((p) => p.sectionId === section.id);
      return {
        key: `${section.id}-${course.id}`,
        sectionId: section.id,
        courseId: course.id,
        section: { id: section.id, label: section.label, batch: section.batch },
        offered: Boolean(link),
        classroomId: link?.classroom?.id ?? null,
        teacher: link ? link.teacher : (planned?.teacher ?? null),
      };
    }),
  }));
}

// ---- Current diplomas ---------------------------------------------------------------------

/**
 * The term whose diplomas are current: an open registration's term while one
 * is open (registration for Fall opens before Fall starts), else today's term.
 */
export async function getCurrentTerm(now = new Date()): Promise<Term> {
  const registration = await prisma.registration.findFirst({
    where: openRegistrationWhere(now),
    orderBy: { startDate: "desc" },
  });
  return registration ? { semester: registration.semester as Semester, year: registration.year } : getTermOn(now);
}

/** For each programme, which diploma every batch studies this term. */
export async function currentDiplomas(now = new Date()) {
  const [term, batches, diplomas] = await Promise.all([
    getCurrentTerm(now),
    getBatchDetails(),
    prisma.department.findMany({ orderBy: [{ semester: "asc" }, { id: "asc" }] }),
  ]);
  const current: { departmentId: number; batch: string }[] = [];
  for (const programme of new Set(diplomas.map((d) => d.category))) {
    const programmeDiplomas = diplomas.filter((d) => d.category === programme);
    for (const { name, year } of batches) {
      const diploma = diplomaForTerm(programmeDiplomas, year, term);
      if (diploma) {
        current.push({ departmentId: diploma.id, batch: name });
      }
    }
  }
  return { term, current };
}

/** Offers every course of a diploma to every section of a batch. */
export async function offerDiplomaToBatch(departmentId: number, batch: string, actorId: string | null) {
  const [sections, courses] = await Promise.all([
    ensureBatchSections(departmentId, batch),
    prisma.course.findMany({ where: { departmentId }, select: { id: true } }),
  ]);
  return linkCourses(
    courses.map((c) => c.id),
    sections.map((s) => s.id),
    actorId,
  );
}

/** Offers each batch the full course list of the diploma it studies this term. */
export async function offerCurrentDiplomas(actorId: string | null, now = new Date()) {
  const { current } = await currentDiplomas(now);
  let count = 0;
  for (const { departmentId, batch } of current) {
    count += await offerDiplomaToBatch(departmentId, batch, actorId);
  }
  return {
    count,
    message:
      count > 0
        ? `Offered ${count} course-section(s) for this term's diplomas.`
        : "Every batch already has its current diploma's courses on offer.",
  };
}

/** The offering summary per diploma and batch, for the Offer Courses pages. */
export async function offeringOverview(params: { category?: string }) {
  const [{ term, current }, departments] = await Promise.all([
    currentDiplomas(),
    prisma.department.findMany({
      where: params.category ? { category: params.category } : {},
      include: {
        courses: { select: { id: true } },
        sections: {
          select: { id: true, batch: true, label: true, courseLinks: { select: { courseId: true } } },
        },
      },
      orderBy: [{ semester: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    term,
    departments: departments.map((department) => {
      const batches = [...new Set(department.sections.map((s) => s.batch))];
      return {
        id: department.id,
        name: department.name,
        code: department.code,
        category: department.category,
        semester: department.semester,
        color: department.color,
        bg: department.bg,
        courseCount: department.courses.length,
        currentBatches: current.filter((c) => c.departmentId === department.id).map((c) => c.batch),
        batches: batches.map((batch) => {
          const sections = department.sections.filter((s) => s.batch === batch);
          const offered = new Set(sections.flatMap((s) => s.courseLinks.map((l) => l.courseId)));
          return { batch, sections: sections.length, offeredCourses: offered.size };
        }),
      };
    }),
  };
}

/** One diploma and batch: every course of the programme and where it's offered. */
export async function batchOfferings(departmentId: number, batch: string) {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    throw notFoundError("Diploma not found.");
  }
  const [sections, courses] = await Promise.all([
    prisma.section.findMany({
      where: { departmentId, batch },
      include: {
        courseLinks: {
          include: { teacher: { select: { id: true, name: true } }, classroom: { select: { id: true } } },
        },
      },
      orderBy: { label: "asc" },
    }),
    prisma.course.findMany({
      where: { department: { category: department.category } },
      include: { department: { select: { id: true, code: true, name: true, semester: true } } },
      orderBy: [{ department: { semester: "asc" } }, { code: "asc" }],
    }),
  ]);
  return {
    department,
    batch,
    sections: sections.map((s) => ({ id: s.id, label: s.label })),
    courses: courses.map((course) => {
      const links = sections.flatMap((section) =>
        section.courseLinks
          .filter((link) => link.courseId === course.id)
          .map((link) => ({
            sectionId: section.id,
            label: section.label,
            teacher: link.teacher,
            classroomId: link.classroom?.id ?? null,
          })),
      );
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        creditHours: course.creditHours,
        department: course.department,
        ownDiploma: course.departmentId === departmentId,
        offeredTo: links,
      };
    }),
  };
}

