import { prisma } from "@/lib/prisma";
import { ClassroomStatus, UserRole } from "@/generated/prisma/enums";

import type { PlatformStats } from "../types";

export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    roleCounts,
    classroomCount,
    assignmentCount,
    submissionCount,
    announcementCount,
    notificationCount,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.classroom.count({ where: { status: { not: ClassroomStatus.DELETED } } }),
    prisma.assignment.count({ where: { deletedAt: null } }),
    prisma.submission.count({ where: { deletedAt: null } }),
    prisma.announcement.count({ where: { deletedAt: null } }),
    prisma.notification.count({ where: { deletedAt: null } }),
  ]);

  const roleMap = new Map(roleCounts.map((row) => [row.role, row._count]));

  return {
    totalUsers: roleCounts.reduce((sum, row) => sum + row._count, 0),
    adminCount: roleMap.get(UserRole.ADMIN) ?? 0,
    teacherCount: roleMap.get(UserRole.TEACHER) ?? 0,
    studentCount: roleMap.get(UserRole.STUDENT) ?? 0,
    classroomCount,
    assignmentCount,
    submissionCount,
    announcementCount,
    notificationCount,
  };
}
