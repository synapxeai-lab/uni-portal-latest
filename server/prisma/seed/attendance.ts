import type { PrismaClient } from "@/generated/prisma/client";

/** Attendance for the last five weekdays of every seeded DTM class (only where none exists yet). */
export async function seedAttendance(prisma: PrismaClient) {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < 5) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
      days.push(new Date(cursor));
    }
  }
  const enrollments = await prisma.enrollment.findMany({
    where: { course: { department: { code: "DTM" } }, attendance: { none: {} } },
    select: { id: true },
  });
  const statuses = ["PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT"];
  const data = enrollments.flatMap((e, i) =>
    days.map((date, d) => ({ enrollmentId: e.id, date, status: statuses[(i + d * 2) % statuses.length] })),
  );
  await prisma.attendance.createMany({ data, skipDuplicates: true });
  return data.length;
}
