import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { withCourseStatus } from "../lib/course-status";
import { applyDiscount, courseTotalFee, discountRateField } from "../lib/fee";
import { conflictError, notFoundError } from "../lib/http";
import { categoryKeyField } from "../lib/programme-categories";
import { withCurrentDiplomas } from "../lib/terms";

const semesterField = z
  .number()
  .int("Semester is required")
  .min(1, "Semester must be at least 1")
  .max(20, "Semester must be at most 20");

// `semester` is the diploma's position in its programme; left out on create,
// the diploma becomes the programme's next semester. studentsCount is derived
// from the students, never set by the client.
export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  code: z.string().trim().min(1, "Code is required"),
  color: z.string().min(1, "Color is required"),
  bg: z.string().min(1, "Background color is required"),
  description: z.string().trim().min(1, "Description is required"),
  head: z.string().trim().min(1, "Head of department is required"),
  category: categoryKeyField("Programme is required"),
  semester: semesterField.optional(),
  discountRate: discountRateField.optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

const include = {
  courses: {
    include: { extraFees: { orderBy: { id: "asc" } }, _count: { select: { sectionLinks: true } } },
    orderBy: { code: "asc" },
  },
  sections: {
    include: {
      courseLinks: {
        include: {
          // A course can be offered from another diploma of the programme, so
          // say which diploma it comes from.
          course: {
            include: {
              _count: { select: { sectionLinks: true } },
              department: { select: { id: true, name: true, code: true, semester: true } },
            },
          },
          teacher: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { students: true } },
    },
    orderBy: [{ batch: "desc" }, { label: "asc" }],
  },
} satisfies Prisma.DepartmentInclude;

type DepartmentRow = Prisma.DepartmentGetPayload<{ include: typeof include }>;

/** Students per diploma: each student counts towards the diploma they study this term. */
async function getStudentCounts(): Promise<Map<number, number>> {
  const students = await withCurrentDiplomas(
    await prisma.student.findMany({ select: { id: true, programme: true, batch: true } }),
  );
  const counts = new Map<number, number>();
  for (const student of students) {
    if (student.currentDiploma) {
      counts.set(student.currentDiploma.id, (counts.get(student.currentDiploma.id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The diploma's fee is the sum of its courses' full fees; its discountRate
 * applies to that sum. Course status and studentsCount are computed.
 */
function present(department: DepartmentRow, studentCounts: Map<number, number>) {
  const fee = department.courses.reduce((sum, course) => sum + courseTotalFee(course), 0);
  return {
    ...department,
    fee,
    netFee: applyDiscount(fee, department.discountRate),
    studentsCount: studentCounts.get(department.id) ?? 0,
    courses: department.courses.map(withCourseStatus),
    sections: department.sections.map((section) => ({
      ...section,
      courseLinks: section.courseLinks.map((link) => ({ ...link, course: withCourseStatus(link.course) })),
    })),
  };
}

export async function listDepartments(params: { search?: string; category?: string }) {
  const [departments, studentCounts] = await Promise.all([
    prisma.department.findMany({
      where: {
        ...(params.category ? { category: params.category.toUpperCase() } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: "insensitive" } },
                { code: { contains: params.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include,
      orderBy: [{ semester: "asc" }, { name: "asc" }],
    }),
    getStudentCounts(),
  ]);
  return departments.map((department) => present(department, studentCounts));
}

export async function getDepartment(id: number) {
  const [department, studentCounts] = await Promise.all([
    prisma.department.findUnique({ where: { id }, include }),
    getStudentCounts(),
  ]);
  if (!department) {
    throw notFoundError("Diploma not found.");
  }
  return present(department, studentCounts);
}

async function assertNameAndCodeFree(name: string | undefined, code: string | undefined, exceptId?: number) {
  if (!name && !code) {
    return;
  }
  const clash = await prisma.department.findFirst({
    where: {
      ...(exceptId ? { id: { not: exceptId } } : {}),
      OR: [...(name ? [{ name }] : []), ...(code ? [{ code }] : [])],
    },
  });
  if (clash) {
    throw conflictError("A diploma with this name or code already exists.");
  }
}

async function assertSemesterFree(category: string, semester: number, exceptId?: number) {
  const clash = await prisma.department.findFirst({
    where: { category, semester, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) {
    throw conflictError(`Another diploma in this programme is already Semester ${semester}.`);
  }
}

export async function createDepartment(input: z.infer<typeof createDepartmentSchema>) {
  await assertNameAndCodeFree(input.name, input.code);
  let { semester } = input;
  if (semester == null) {
    const last = await prisma.department.aggregate({
      where: { category: input.category },
      _max: { semester: true },
    });
    semester = (last._max.semester ?? 0) + 1;
  } else {
    await assertSemesterFree(input.category, semester);
  }
  const department = await prisma.department.create({ data: { ...input, semester } });
  return getDepartment(department.id);
}

export async function updateDepartment(id: number, input: z.infer<typeof updateDepartmentSchema>) {
  const target = await prisma.department.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Diploma not found.");
  }
  await assertNameAndCodeFree(
    input.name !== target.name ? input.name : undefined,
    input.code !== target.code ? input.code : undefined,
    id,
  );
  const category = input.category ?? target.category;
  const semester = input.semester ?? target.semester;
  if (category !== target.category || semester !== target.semester) {
    await assertSemesterFree(category, semester, id);
  }
  await prisma.department.update({ where: { id }, data: input });
  return getDepartment(id);
}

export async function deleteDepartment(id: number) {
  const target = await prisma.department.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Diploma not found.");
  }
  await prisma.department.delete({ where: { id } });
}
