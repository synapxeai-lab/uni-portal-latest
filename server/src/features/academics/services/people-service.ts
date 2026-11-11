import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { getBatchYears, isValidBatch } from "../lib/batches";
import { conflictError, notFoundError } from "../lib/http";
import { categoryKeyField } from "../lib/programme-categories";
import { syncEnrolledSection } from "../lib/section-sync";
import { amountField, payError, TEACHER_TYPES } from "../lib/teacher-pay";
import { computeStudentSemester, withCurrentDiplomas } from "../lib/terms";
import { archiveLogin, ensureLoginFor, syncLogin } from "../lib/user-accounts";

const cnic = (label: string) =>
  z.string().trim().regex(/^\d{5}-\d{7}-\d$/, `${label} must be in format 12345-1234567-1`);
const required = (message: string) => z.string().trim().min(1, message);

// ---- Teachers -------------------------------------------------------------------------

const teacherFields = {
  name: z.string().trim().min(2, "Teacher name must be at least 2 characters"),
  phone: required("Phone number is required"),
  email: z.string().trim().email("Invalid email address"),
  address: required("Address is required"),
  cnic: cnic("CNIC"),
  qualification: required("Qualification is required"),
  programme: categoryKeyField(),
  type: z.enum(TEACHER_TYPES, { error: "Teacher type is required" }).optional(),
  salary: amountField("Salary").nullable().optional(),
  ratePerCreditHour: amountField("Rate per credit hour").nullable().optional(),
  guardianName: required("Guardian name is required"),
  guardianContact: required("Guardian contact is required"),
  guardianCnic: cnic("Guardian CNIC"),
};
export const createTeacherSchema = z.object(teacherFields);
export const updateTeacherSchema = z.object(teacherFields).partial();

const teacherInclude = {
  sectionCourses: {
    include: {
      course: { select: { id: true, code: true, name: true, creditHours: true } },
      section: { select: { id: true, label: true, batch: true } },
    },
  },
  user: { select: { id: true, status: true } },
} satisfies Prisma.TeacherInclude;

export function listTeachers(search?: string) {
  return prisma.teacher.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: teacherInclude,
    orderBy: { name: "asc" },
  });
}

export async function getTeacher(id: number) {
  const teacher = await prisma.teacher.findUnique({ where: { id }, include: teacherInclude });
  if (!teacher) {
    throw notFoundError("Teacher not found.");
  }
  return teacher;
}

async function assertTeacherUnique(email?: string, cnicValue?: string, exceptId?: number) {
  if (!email && !cnicValue) {
    return;
  }
  const clash = await prisma.teacher.findFirst({
    where: {
      ...(exceptId ? { id: { not: exceptId } } : {}),
      OR: [...(email ? [{ email }] : []), ...(cnicValue ? [{ cnic: cnicValue }] : [])],
    },
  });
  if (clash) {
    throw conflictError("A teacher with this email or CNIC already exists.");
  }
}

export async function createTeacher(input: z.infer<typeof createTeacherSchema>) {
  const invalidPay = payError({ type: "PERMANENT", ...input });
  if (invalidPay) {
    throw badRequest(invalidPay);
  }
  await assertTeacherUnique(input.email, input.cnic);
  const { userId, login } = await ensureLoginFor(input, UserRole.TEACHER);
  const teacher = await prisma.teacher.create({ data: { ...input, userId }, include: teacherInclude });
  return { teacher, login };
}

export async function updateTeacher(id: number, input: z.infer<typeof updateTeacherSchema>) {
  const target = await prisma.teacher.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Teacher not found.");
  }
  const invalidPay = payError({ ...target, ...input });
  if (invalidPay) {
    throw badRequest(invalidPay);
  }
  await assertTeacherUnique(
    input.email !== target.email ? input.email : undefined,
    input.cnic !== target.cnic ? input.cnic : undefined,
    id,
  );
  const teacher = await prisma.teacher.update({ where: { id }, data: input, include: teacherInclude });
  await syncLogin(teacher.userId, teacher);
  return teacher;
}

export async function deleteTeacher(id: number) {
  const target = await prisma.teacher.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Teacher not found.");
  }
  await prisma.teacher.delete({ where: { id } });
  await archiveLogin(target.userId);
}

// ---- Students -------------------------------------------------------------------------

// "YYYY-MM-DD" from a date input, stored as midnight UTC.
const dob = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is required")
  .transform((value) => new Date(`${value}T00:00:00Z`))
  .refine((date) => !Number.isNaN(date.getTime()) && date < new Date(), {
    message: "Enter a valid date of birth",
  });

const studentFields = {
  name: z.string().trim().min(2, "Student name must be at least 2 characters"),
  rollNo: required("Roll number is required"),
  email: z.string().trim().email("Invalid email address"),
  phone: required("Phone number is required"),
  address: required("Address is required"),
  cnic: cnic("CNIC"),
  dob,
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Gender is required" }),
  lastQualification: required("Last qualification is required"),
  passingYear: z.coerce
    .number({ error: "Passing year is required" })
    .int()
    .min(1950, "Enter a valid passing year")
    .max(new Date().getFullYear() + 1, "Enter a valid passing year"),
  grade: required("Grade is required"),
  university: required("Board / university is required"),
  programme: categoryKeyField(),
  batch: required("Batch is required").refine(isValidBatch, { message: "Select a valid batch" }),
  section: required("Section is required"),
  guardianName: required("Guardian name is required"),
  guardianContact: required("Guardian contact is required"),
  guardianCnic: cnic("Guardian CNIC"),
  guardianRelationship: required("Guardian relationship is required"),
  guardianEmail: z.string().trim().email("Invalid guardian email address"),
};
export const createStudentSchema = z.object(studentFields);
export const updateStudentSchema = z.object(studentFields).partial();

const SEMESTER_RANK: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

export async function listStudents(params: { search?: string; programme?: string; batch?: string }) {
  const students = await prisma.student.findMany({
    where: {
      ...(params.programme ? { programme: params.programme } : {}),
      ...(params.batch ? { batch: params.batch } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
              { rollNo: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { user: { select: { id: true, status: true } } },
    orderBy: { name: "asc" },
  });
  return withCurrentDiplomas(students);
}

/** A student's record plus their registrations grouped by term, newest first. */
export async function getStudent(id: number) {
  const found = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, status: true } },
      enrolledSections: { include: { department: { select: { id: true, name: true, code: true } } } },
    },
  });
  if (!found) {
    throw notFoundError("Student not found.");
  }
  const [[student], batchYears, enrollments] = await Promise.all([
    withCurrentDiplomas([found]),
    getBatchYears(),
    prisma.enrollment.findMany({
      where: { studentId: id },
      include: {
        registration: true,
        course: { include: { department: { select: { name: true, code: true } } } },
        section: { select: { id: true, label: true, batch: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const batchYear = batchYears.get(student.batch) ?? null;

  const links = enrollments.length
    ? await prisma.sectionCourse.findMany({
        where: { OR: enrollments.map((e) => ({ sectionId: e.sectionId, courseId: e.courseId })) },
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          classroom: { select: { id: true } },
        },
      })
    : [];
  const linkFor = new Map(links.map((link) => [`${link.sectionId}-${link.courseId}`, link]));

  const groups = new Map<
    string,
    {
      semester: string;
      year: number;
      semesterNumber: number | null;
      diploma: { name: string; code: string };
      courses: unknown[];
    }
  >();
  for (const e of enrollments) {
    const key = `${e.registration.semester}-${e.registration.year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        semester: e.registration.semester,
        year: e.registration.year,
        semesterNumber: computeStudentSemester(batchYear, e.registration.semester, e.registration.year),
        diploma: { name: e.course.department.name, code: e.course.department.code },
        courses: [],
      });
    }
    const link = linkFor.get(`${e.sectionId}-${e.courseId}`);
    groups.get(key)!.courses.push({
      enrollmentId: e.id,
      id: e.course.id,
      code: e.course.code,
      name: e.course.name,
      creditHours: e.course.creditHours,
      section: e.section,
      teacher: link?.teacher ?? null,
      classroomId: link?.classroom?.id ?? null,
      grade: e.publishedGrade,
    });
  }
  return {
    student,
    groups: [...groups.values()].sort(
      (a, b) => b.year - a.year || SEMESTER_RANK[b.semester] - SEMESTER_RANK[a.semester],
    ),
  };
}

async function assertStudentUnique(fields: { email?: string; cnic?: string; rollNo?: string }, exceptId?: number) {
  const or = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => ({ [key]: value }));
  if (or.length === 0) {
    return;
  }
  const clash = await prisma.student.findFirst({
    where: { ...(exceptId ? { id: { not: exceptId } } : {}), OR: or },
  });
  if (clash) {
    throw conflictError("A student with this email, CNIC, or roll number already exists.");
  }
}

export async function createStudent(input: z.infer<typeof createStudentSchema>) {
  await assertStudentUnique({ email: input.email, cnic: input.cnic, rollNo: input.rollNo });
  const { userId, login } = await ensureLoginFor(input, UserRole.STUDENT);
  const student = await prisma.student.create({ data: { ...input, userId } });
  await syncEnrolledSection(student.id);
  return { student, login };
}

export async function updateStudent(id: number, input: z.infer<typeof updateStudentSchema>) {
  const target = await prisma.student.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Student not found.");
  }
  await assertStudentUnique(
    {
      email: input.email !== target.email ? input.email : undefined,
      cnic: input.cnic !== target.cnic ? input.cnic : undefined,
      rollNo: input.rollNo !== target.rollNo ? input.rollNo : undefined,
    },
    id,
  );
  const student = await prisma.student.update({ where: { id }, data: input });
  await syncEnrolledSection(student.id);
  await syncLogin(student.userId, student);
  return student;
}

export async function deleteStudent(id: number) {
  const target = await prisma.student.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Student not found.");
  }
  await prisma.student.delete({ where: { id } });
  await archiveLogin(target.userId);
}

// ---- Section membership -----------------------------------------------------------------

export async function addStudentToSection(sectionId: number, studentId: number) {
  const [section, student] = await Promise.all([
    prisma.section.findUnique({
      where: { id: sectionId },
      include: { department: true, students: { select: { id: true } } },
    }),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!section) {
    throw notFoundError("Section not found.");
  }
  if (!student) {
    throw notFoundError("Student not found.");
  }
  if (student.programme !== section.department.category) {
    throw badRequest("This section's diploma isn't part of the student's programme.");
  }
  if (student.batch !== section.batch) {
    throw badRequest(
      `Student's batch (${student.batch}) does not match this section's batch (${section.batch}).`,
    );
  }
  if (section.students.some((s) => s.id === studentId)) {
    throw conflictError("Student is already in this section.");
  }
  await prisma.section.update({ where: { id: sectionId }, data: { students: { connect: { id: studentId } } } });
}

export async function removeStudentFromSection(sectionId: number, studentId: number) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { students: { where: { id: studentId }, select: { id: true } } },
  });
  if (!section) {
    throw notFoundError("Section not found.");
  }
  if (section.students.length === 0) {
    throw notFoundError("Student is not in this section.");
  }
  await prisma.section.update({
    where: { id: sectionId },
    data: { students: { disconnect: { id: studentId } } },
  });
}
