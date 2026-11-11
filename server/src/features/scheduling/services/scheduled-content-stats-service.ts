import { prisma } from "@/lib/prisma";
import { AnnouncementStatus, AssignmentStatus, MaterialStatus } from "@/generated/prisma/enums";

import type { ScheduledContentStats, UpcomingPublicationItem } from "../types";

const UPCOMING_PUBLICATIONS_LIMIT = 5;

function classroomScope(classroomIds?: string[]) {
  return classroomIds ? { classroomId: { in: classroomIds } } : {};
}

/**
 * Counts of currently-Scheduled content per type, reused by both the
 * Teacher dashboard (scoped to the classrooms they manage) and the Admin
 * dashboard (platform-wide, when classroomIds is omitted). All three status
 * fields are covered by the existing (status, scheduledFor) index added in
 * Phase 14.1, so each count is a single indexed lookup - three queries total,
 * run in parallel, regardless of platform size.
 */
export async function getScheduledContentStats(
  classroomIds?: string[],
): Promise<ScheduledContentStats> {
  if (classroomIds && classroomIds.length === 0) {
    return { announcementCount: 0, assignmentCount: 0, materialCount: 0, total: 0 };
  }

  const scope = classroomScope(classroomIds);

  const [announcementCount, assignmentCount, materialCount] = await Promise.all([
    prisma.announcement.count({
      where: { status: AnnouncementStatus.SCHEDULED, deletedAt: null, ...scope },
    }),
    prisma.assignment.count({
      where: { status: AssignmentStatus.SCHEDULED, deletedAt: null, ...scope },
    }),
    prisma.material.count({
      where: { status: MaterialStatus.SCHEDULED, deletedAt: null, ...scope },
    }),
  ]);

  return {
    announcementCount,
    assignmentCount,
    materialCount,
    total: announcementCount + assignmentCount + materialCount,
  };
}

/**
 * The soonest-to-publish Scheduled items across all three content types,
 * merged and sorted. Each type is queried independently with its own
 * `take: limit` (bounded, indexed by (status, scheduledFor)), then merged
 * and re-sliced in memory - three small, cheap queries instead of a cross-
 * table UNION, which Prisma doesn't support natively.
 */
export async function getUpcomingPublications(
  classroomIds: string[],
  limit = UPCOMING_PUBLICATIONS_LIMIT,
): Promise<UpcomingPublicationItem[]> {
  if (classroomIds.length === 0) {
    return [];
  }

  const scope = { classroomId: { in: classroomIds } };

  const [announcements, assignments, materials] = await Promise.all([
    prisma.announcement.findMany({
      where: { status: AnnouncementStatus.SCHEDULED, deletedAt: null, ...scope },
      select: {
        id: true,
        title: true,
        classroomId: true,
        scheduledFor: true,
        classroom: { select: { title: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    }),
    prisma.assignment.findMany({
      where: { status: AssignmentStatus.SCHEDULED, deletedAt: null, ...scope },
      select: {
        id: true,
        title: true,
        classroomId: true,
        scheduledFor: true,
        classroom: { select: { title: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    }),
    prisma.material.findMany({
      where: { status: MaterialStatus.SCHEDULED, deletedAt: null, ...scope },
      select: {
        id: true,
        title: true,
        classroomId: true,
        scheduledFor: true,
        classroom: { select: { title: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    }),
  ]);

  const merged: UpcomingPublicationItem[] = [
    ...announcements.map((row) => ({
      id: row.id,
      contentType: "announcement" as const,
      title: row.title,
      classroomId: row.classroomId,
      classroomTitle: row.classroom.title,
      scheduledFor: row.scheduledFor as Date,
    })),
    ...assignments.map((row) => ({
      id: row.id,
      contentType: "assignment" as const,
      title: row.title,
      classroomId: row.classroomId,
      classroomTitle: row.classroom.title,
      scheduledFor: row.scheduledFor as Date,
    })),
    ...materials.map((row) => ({
      id: row.id,
      contentType: "material" as const,
      title: row.title,
      classroomId: row.classroomId,
      classroomTitle: row.classroom.title,
      scheduledFor: row.scheduledFor as Date,
    })),
  ];

  return merged.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()).slice(0, limit);
}
