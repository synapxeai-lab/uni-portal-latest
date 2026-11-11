import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { getSelfStudent } from "../lib/self";

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"] as const;
type Status = (typeof ATTENDANCE_STATUSES)[number];

/** A class day as a date-only value (stored at UTC midnight). */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required")
  .transform((value) => new Date(`${value}T00:00:00Z`));

export const saveAttendanceSchema = z.object({
  date: dateOnly,
  records: z.array(z.object({ enrollmentId: z.number().int(), status: z.enum(ATTENDANCE_STATUSES) })),
});

/**
 * The roster comes from registrations, not section membership: a student is
 * only listed once registered for this course in this section.
 */
async function roster(courseId: number, sectionId: number, date: Date) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, sectionId },
    include: {
      student: { select: { id: true, name: true, rollNo: true } },
      attendance: { where: { date }, select: { status: true } },
    },
    orderBy: { student: { name: "asc" } },
  });
  return enrollments.map((e) => ({
    enrollmentId: e.id,
    student: e.student,
    status: (e.attendance[0]?.status as Status | undefined) ?? null,
  }));
}

/** Every date attendance was taken, newest first, with counts per status. */
async function dates(courseId: number, sectionId: number) {
  const counts = await prisma.attendance.groupBy({
    by: ["date", "status"],
    where: { enrollment: { courseId, sectionId } },
    _count: { _all: true },
  });
  const byDate = new Map<string, { date: Date; PRESENT: number; LATE: number; ABSENT: number; total: number }>();
  for (const row of counts) {
    const key = row.date.toISOString();
    const entry = byDate.get(key) ?? { date: row.date, PRESENT: 0, LATE: 0, ABSENT: 0, total: 0 };
    entry[row.status as Status] = row._count._all;
    entry.total += row._count._all;
    byDate.set(key, entry);
  }
  return [...byDate.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** The attendance page: the roster for one date plus the history of dates taken. */
export async function getAttendance(courseId: number, sectionId: number, date: Date) {
  const [students, history] = await Promise.all([roster(courseId, sectionId, date), dates(courseId, sectionId)]);
  return { date, roster: students, dates: history };
}

/** Saves a day's marks; records for students not registered here are ignored. */
export async function saveAttendance(courseId: number, sectionId: number, input: z.infer<typeof saveAttendanceSchema>) {
  const valid = new Set(
    (await prisma.enrollment.findMany({ where: { courseId, sectionId }, select: { id: true } })).map((e) => e.id),
  );
  const records = input.records.filter((r) => valid.has(r.enrollmentId));
  await prisma.$transaction(
    records.map((r) =>
      prisma.attendance.upsert({
        where: { enrollmentId_date: { enrollmentId: r.enrollmentId, date: input.date } },
        update: { status: r.status },
        create: { enrollmentId: r.enrollmentId, date: input.date, status: r.status },
      }),
    ),
  );
  return { saved: records.length };
}

function summarize(records: { status: string }[]) {
  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const total = records.length;
  return { present, late, absent, total, percentage: total ? Math.round(((present + late) / total) * 100) : null };
}

const SEMESTER_RANK: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2 };

/** A student's attendance in every registered course, grouped by term. */
export async function getMyAttendance(userId: string) {
  const student = await getSelfStudent(userId);
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      registration: { select: { semester: true, year: true } },
      course: { select: { id: true, code: true, name: true, creditHours: true } },
      section: { select: { id: true, label: true } },
      attendance: { orderBy: { date: "asc" }, select: { date: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, { semester: string; year: number; courses: unknown[] }>();
  for (const e of enrollments) {
    const key = `${e.registration.semester}-${e.registration.year}`;
    if (!groups.has(key)) {
      groups.set(key, { semester: e.registration.semester, year: e.registration.year, courses: [] });
    }
    groups.get(key)!.courses.push({
      enrollmentId: e.id,
      id: e.course.id,
      code: e.course.code,
      name: e.course.name,
      creditHours: e.course.creditHours,
      section: e.section,
      summary: summarize(e.attendance),
      records: e.attendance,
    });
  }
  return {
    groups: [...groups.values()].sort((a, b) => b.year - a.year || SEMESTER_RANK[b.semester] - SEMESTER_RANK[a.semester]),
  };
}

/**
 * Admin overview: every offering of the current registrations with its
 * registered students, days taken and overall attendance rate. Two queries.
 */
export async function attendanceOverview(params: { category?: string }) {
  const offerings = await prisma.sectionCourse.findMany({
    where: params.category ? { section: { department: { category: params.category } } } : {},
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, label: true, batch: true, department: { select: { code: true } } } },
      teacher: { select: { name: true } },
      classroom: { select: { id: true } },
    },
    orderBy: [{ section: { batch: "desc" } }, { course: { code: "asc" } }, { section: { label: "asc" } }],
  });
  const stats = await prisma.$queryRaw<
    { courseId: number; sectionId: number; students: bigint; days: bigint; attended: bigint; marked: bigint }[]
  >`
    SELECT e."courseId", e."sectionId",
           COUNT(DISTINCT e.id) AS students,
           COUNT(DISTINCT a.date) AS days,
           COUNT(a.id) FILTER (WHERE a.status IN ('PRESENT', 'LATE')) AS attended,
           COUNT(a.id) AS marked
    FROM "Enrollment" e
    LEFT JOIN "Attendance" a ON a."enrollmentId" = e.id
    GROUP BY e."courseId", e."sectionId"`;
  const byKey = new Map(stats.map((s) => [`${s.sectionId}-${s.courseId}`, s]));
  return offerings.map((o) => {
    const s = byKey.get(`${o.sectionId}-${o.courseId}`);
    const marked = Number(s?.marked ?? 0);
    return {
      sectionId: o.sectionId,
      courseId: o.courseId,
      course: o.course,
      section: o.section,
      teacher: o.teacher,
      classroomId: o.classroom?.id ?? null,
      students: Number(s?.students ?? 0),
      days: Number(s?.days ?? 0),
      percentage: marked ? Math.round((Number(s?.attended ?? 0) / marked) * 100) : null,
    };
  });
}
