import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { withCourseStatus } from "../lib/course-status";
import { discountRateField, feeField } from "../lib/fee";
import { conflictError, notFoundError } from "../lib/http";

const creditHoursField = z
  .number()
  .int()
  .min(1, "Credit hours must be at least 1")
  .max(100, "Credit hours must be at most 100");

// A course can be added to several diplomas at once (departmentIds); each gets
// its own copy with the same code.
export const createCourseSchema = z.object({
  departmentIds: z.array(z.number().int()).min(1, "Select at least one diploma"),
  name: z.string().trim().min(2, "Course name must be at least 2 characters"),
  code: z.string().trim().min(1, "Course code is required"),
  creditHours: creditHoursField,
  fee: feeField.optional(),
  discountRate: discountRateField.optional(),
});

export const updateCourseSchema = z.object({
  departmentId: z.number().int().optional(),
  name: z.string().trim().min(2, "Course name must be at least 2 characters").optional(),
  code: z.string().trim().min(1, "Course code is required").optional(),
  creditHours: creditHoursField.optional(),
  fee: feeField.optional(),
  discountRate: discountRateField.optional(),
});

export const copyCourseSchema = z.object({ departmentId: z.number().int("Diploma is required") });

export const extraFeeSchema = z.object({
  name: z
    .string({ error: "Fee name is required" })
    .trim()
    .min(1, "Fee name is required")
    .max(60, "Fee name must be at most 60 characters"),
  amount: feeField.refine((amount) => amount > 0, "Amount must be more than 0"),
});

const listInclude = {
  department: true,
  extraFees: { orderBy: { id: "asc" } },
  assessmentScheme: { orderBy: { createdAt: "asc" } },
  _count: { select: { sectionLinks: true } },
} satisfies Prisma.CourseInclude;

const detailInclude = {
  department: true,
  extraFees: { orderBy: { id: "asc" } },
  assessmentScheme: { orderBy: { createdAt: "asc" } },
  sectionLinks: {
    include: {
      section: true,
      teacher: { select: { id: true, name: true, email: true } },
      classroom: { select: { id: true, code: true, status: true } },
    },
    orderBy: [{ section: { batch: "asc" } }, { section: { label: "asc" } }],
  },
} satisfies Prisma.CourseInclude;

export interface ListCoursesParams {
  search?: string;
  departmentId?: number;
  category?: string;
  semester?: number;
  status?: string;
}

export async function listCourses(params: ListCoursesParams) {
  const courses = await prisma.course.findMany({
    where: {
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { code: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      // A course's semester is its diploma's semester within the programme.
      ...(params.category || params.semester
        ? {
            department: {
              ...(params.category ? { category: params.category } : {}),
              ...(params.semester ? { semester: params.semester } : {}),
            },
          }
        : {}),
      ...(params.status === "ACTIVE" ? { sectionLinks: { some: {} } } : {}),
      ...(params.status === "INACTIVE" ? { sectionLinks: { none: {} } } : {}),
    },
    include: listInclude,
    orderBy: [{ department: { semester: "asc" } }, { departmentId: "asc" }, { code: "asc" }],
  });
  return courses.map(withCourseStatus);
}

export async function getCourse(id: number) {
  const course = await prisma.course.findUnique({ where: { id }, include: detailInclude });
  if (!course) {
    throw notFoundError("Course not found.");
  }
  return withCourseStatus(course);
}

export async function createCourse(input: z.infer<typeof createCourseSchema>) {
  const departmentIds = [...new Set(input.departmentIds)];
  const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } } });
  if (departments.length !== departmentIds.length) {
    throw notFoundError("Diploma not found.");
  }
  const existing = await prisma.course.findMany({
    where: { code: input.code, departmentId: { in: departmentIds } },
    include: { department: { select: { name: true } } },
  });
  if (existing.length) {
    throw conflictError(
      `A course with this code already exists in ${existing.map((c) => c.department.name).join(", ")}.`,
    );
  }
  // Sections are linked to these courses from the Offer Courses page.
  const courses = await prisma.$transaction(
    departmentIds.map((departmentId) =>
      prisma.course.create({
        data: {
          departmentId,
          name: input.name,
          code: input.code,
          creditHours: input.creditHours,
          fee: input.fee ?? 0,
          discountRate: input.discountRate ?? 0,
        },
        include: listInclude,
      }),
    ),
  );
  return courses.map(withCourseStatus);
}

/** Adds an existing course to another diploma: a copy with the same code, fees and scheme. */
export async function copyCourse(id: number, departmentId: number) {
  const [source, department] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: { assessmentScheme: true, extraFees: { orderBy: { id: "asc" } } },
    }),
    prisma.department.findUnique({ where: { id: departmentId } }),
  ]);
  if (!source) {
    throw notFoundError("Course not found.");
  }
  if (!department) {
    throw notFoundError("Diploma not found.");
  }
  const clash = await prisma.course.findUnique({
    where: { departmentId_code: { departmentId, code: source.code } },
  });
  if (clash) {
    throw conflictError(`${department.name} already has a course with code ${source.code}.`);
  }
  const course = await prisma.course.create({
    data: {
      departmentId,
      code: source.code,
      name: source.name,
      creditHours: source.creditHours,
      fee: source.fee,
      discountRate: source.discountRate,
      theoryPercent: source.theoryPercent,
      assessmentScheme: {
        create: source.assessmentScheme.map(({ type, component, weightage }) => ({ type, component, weightage })),
      },
      extraFees: { create: source.extraFees.map(({ name, amount }) => ({ name, amount })) },
    },
    include: listInclude,
  });
  return { course: withCourseStatus(course), department };
}

export async function updateCourse(id: number, input: z.infer<typeof updateCourseSchema>) {
  const target = await prisma.course.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Course not found.");
  }
  if (input.departmentId && !(await prisma.department.count({ where: { id: input.departmentId } }))) {
    throw notFoundError("Diploma not found.");
  }
  const code = input.code ?? target.code;
  const departmentId = input.departmentId ?? target.departmentId;
  if (code !== target.code || departmentId !== target.departmentId) {
    const clash = await prisma.course.findFirst({ where: { code, departmentId, id: { not: id } } });
    if (clash) {
      throw conflictError("A course with this code already exists in that diploma.");
    }
  }
  // Moving a course to another diploma drops its offerings and planned
  // teachers; it is re-offered to the new diploma's batches afterwards.
  const moved = departmentId !== target.departmentId;
  await prisma.$transaction([
    ...(moved
      ? [
          prisma.sectionCourse.deleteMany({ where: { courseId: id } }),
          prisma.plannedAssignment.deleteMany({ where: { courseId: id } }),
        ]
      : []),
    prisma.course.update({ where: { id }, data: input }),
  ]);
  return getCourse(id);
}

export async function deleteCourse(id: number) {
  if (!(await prisma.course.count({ where: { id } }))) {
    throw notFoundError("Course not found.");
  }
  await prisma.course.delete({ where: { id } });
}

async function loadCourseFees(courseId: number) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { extraFees: true } });
  if (!course) {
    throw notFoundError("Course not found.");
  }
  return course;
}

function assertFeeNameFree(fees: { id: number; name: string }[], name: string, exceptId?: number) {
  if (fees.some((fee) => fee.id !== exceptId && fee.name.toLowerCase() === name.toLowerCase())) {
    throw conflictError(`This course already has a fee named "${name}".`);
  }
}

/** Extra fees count towards the course's total, the diploma's fee and students' challans. */
export async function addExtraFee(courseId: number, input: z.infer<typeof extraFeeSchema>) {
  const course = await loadCourseFees(courseId);
  assertFeeNameFree(course.extraFees, input.name);
  await prisma.courseFee.create({ data: { courseId, ...input } });
  return getCourse(courseId);
}

export async function updateExtraFee(courseId: number, feeId: number, input: z.infer<typeof extraFeeSchema>) {
  const course = await loadCourseFees(courseId);
  if (!course.extraFees.some((fee) => fee.id === feeId)) {
    throw notFoundError("Fee not found.");
  }
  assertFeeNameFree(course.extraFees, input.name, feeId);
  await prisma.courseFee.update({ where: { id: feeId }, data: input });
  return getCourse(courseId);
}

export async function deleteExtraFee(courseId: number, feeId: number) {
  const course = await loadCourseFees(courseId);
  const fee = course.extraFees.find((row) => row.id === feeId);
  if (!fee) {
    throw notFoundError("Fee not found.");
  }
  await prisma.courseFee.delete({ where: { id: feeId } });
  return { course: await getCourse(courseId), fee };
}
