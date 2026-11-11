import type { SessionUser } from "@/auth/session";
import { canManageClassroom } from "@/features/classroom/lib/can-manage";
import { notifyClassroomArchived } from "@/features/notifications/services/notification-generator";
import { recordAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  ActivityAction,
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
} from "@/generated/prisma/enums";

import { AdminClassroomServiceError } from "../lib/errors";
import type {
  AdminClassroomDetail,
  AdminClassroomMember,
  AdminClassroomSummary,
  ClassroomsPage,
  ListClassroomsParams,
} from "../types";

const DEFAULT_PAGE_SIZE = 10;

const summaryInclude = {
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { memberships: { where: { status: ClassroomMembershipStatus.ACTIVE } } } },
} satisfies Prisma.ClassroomInclude;

type ClassroomSummaryRow = Prisma.ClassroomGetPayload<{ include: typeof summaryInclude }>;

function toSummary(classroom: ClassroomSummaryRow): AdminClassroomSummary {
  return {
    id: classroom.id,
    title: classroom.title,
    section: classroom.section,
    subject: classroom.subject,
    code: classroom.code,
    status: classroom.status,
    ownerId: classroom.ownerId,
    ownerName: classroom.owner.name,
    ownerEmail: classroom.owner.email,
    memberCount: classroom._count.memberships,
    createdAt: classroom.createdAt,
    updatedAt: classroom.updatedAt,
    deletedAt: classroom.deletedAt,
  };
}

function toOrderBy(
  sortField: ListClassroomsParams["sortField"],
  sortDir: NonNullable<ListClassroomsParams["sortDir"]>,
): Prisma.ClassroomOrderByWithRelationInput {
  switch (sortField) {
    case "title":
      return { title: sortDir };
    case "status":
      return { status: sortDir };
    case "memberCount":
      return { memberships: { _count: sortDir } };
    default:
      return { createdAt: sortDir };
  }
}

export async function listClassrooms(params: ListClassroomsParams): Promise<ClassroomsPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const sortDir = params.sortDir ?? "desc";

  const where: Prisma.ClassroomWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { code: { contains: params.search, mode: "insensitive" } },
            { owner: { name: { contains: params.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [classrooms, total] = await Promise.all([
    prisma.classroom.findMany({
      where,
      include: summaryInclude,
      orderBy: toOrderBy(params.sortField, sortDir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.classroom.count({ where }),
  ]);

  return {
    classrooms: classrooms.map(toSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function loadClassroom(classroomId: string) {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: summaryInclude,
  });

  if (!classroom) {
    throw new AdminClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  return classroom;
}

export async function getClassroomDetail(classroomId: string): Promise<AdminClassroomDetail> {
  const classroom = await loadClassroom(classroomId);

  const [
    memberships,
    topicCount,
    announcementCount,
    materialCount,
    assignmentCount,
    submissionCount,
  ] = await Promise.all([
    prisma.classroomMembership.findMany({
      where: { classroomId, status: ClassroomMembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.topic.count({ where: { classroomId } }),
    prisma.announcement.count({ where: { classroomId, deletedAt: null } }),
    prisma.material.count({ where: { classroomId, deletedAt: null } }),
    prisma.assignment.count({ where: { classroomId, deletedAt: null } }),
    prisma.submission.count({ where: { assignment: { classroomId }, deletedAt: null } }),
  ]);

  const members: AdminClassroomMember[] = memberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    joinedAt: membership.joinedAt,
  }));

  const teacherCount = members.filter((member) => canManageClassroom(member.role)).length;
  const studentCount = members.length - teacherCount;

  return {
    ...toSummary(classroom),
    description: classroom.description,
    room: classroom.room,
    statistics: {
      teacherCount,
      studentCount,
      topicCount,
      announcementCount,
      materialCount,
      assignmentCount,
      submissionCount,
    },
    members,
  };
}

export async function archiveClassroom(
  classroomId: string,
  actor: SessionUser,
): Promise<AdminClassroomSummary> {
  const classroom = await loadClassroom(classroomId);

  if (classroom.status !== ClassroomStatus.ACTIVE) {
    throw new AdminClassroomServiceError(
      "VALIDATION_ERROR",
      "Only active classrooms can be archived.",
    );
  }

  const updated = await prisma.classroom.update({
    where: { id: classroomId },
    data: { status: ClassroomStatus.ARCHIVED },
    include: summaryInclude,
  });

  await recordAuditEvent({
    actorId: actor.id,
    action: ActivityAction.ARCHIVED,
    entityType: "Classroom",
    entityId: classroomId,
    targetLabel: updated.title,
    classroomId,
    metadata: { code: updated.code },
  });

  await notifyClassroomArchived({
    classroomId,
    classroomTitle: updated.title,
    archivedByName: actor.name ?? "Someone",
  });

  return toSummary(updated);
}

export async function restoreClassroom(classroomId: string): Promise<AdminClassroomSummary> {
  const classroom = await loadClassroom(classroomId);

  if (classroom.status === ClassroomStatus.ACTIVE) {
    throw new AdminClassroomServiceError("VALIDATION_ERROR", "This classroom is already active.");
  }

  const updated = await prisma.classroom.update({
    where: { id: classroomId },
    data: { status: ClassroomStatus.ACTIVE, deletedAt: null },
    include: summaryInclude,
  });

  return toSummary(updated);
}

export async function deleteClassroom(classroomId: string): Promise<AdminClassroomSummary> {
  const classroom = await loadClassroom(classroomId);

  if (classroom.status === ClassroomStatus.DELETED) {
    throw new AdminClassroomServiceError("VALIDATION_ERROR", "This classroom is already deleted.");
  }

  const updated = await prisma.classroom.update({
    where: { id: classroomId },
    data: { status: ClassroomStatus.DELETED, deletedAt: new Date() },
    include: summaryInclude,
  });

  return toSummary(updated);
}

export async function transferOwnership(
  classroomId: string,
  newOwnerEmail: string,
): Promise<AdminClassroomSummary> {
  const classroom = await loadClassroom(classroomId);

  const newOwner = await prisma.user.findUnique({ where: { email: newOwnerEmail } });
  if (!newOwner) {
    throw new AdminClassroomServiceError("USER_NOT_FOUND", "No user was found with that email.");
  }

  if (newOwner.id === classroom.ownerId) {
    throw new AdminClassroomServiceError(
      "VALIDATION_ERROR",
      "This user already owns the classroom.",
    );
  }

  const previousOwnerId = classroom.ownerId;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.classroom.update({
      where: { id: classroomId },
      data: { ownerId: newOwner.id },
      include: summaryInclude,
    });

    await tx.classroomMembership.upsert({
      where: { classroomId_userId: { classroomId, userId: newOwner.id } },
      create: {
        classroomId,
        userId: newOwner.id,
        role: ClassroomMembershipRole.OWNER,
        status: ClassroomMembershipStatus.ACTIVE,
      },
      update: { role: ClassroomMembershipRole.OWNER, status: ClassroomMembershipStatus.ACTIVE },
    });

    await tx.classroomMembership.updateMany({
      where: { classroomId, userId: previousOwnerId },
      data: { role: ClassroomMembershipRole.TEACHER },
    });

    return result;
  });

  return toSummary(updated);
}

export async function assignTeacher(
  classroomId: string,
  teacherEmail: string,
): Promise<AdminClassroomMember> {
  const classroom = await loadClassroom(classroomId);

  const user = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!user) {
    throw new AdminClassroomServiceError("USER_NOT_FOUND", "No user was found with that email.");
  }

  if (user.id === classroom.ownerId) {
    throw new AdminClassroomServiceError(
      "VALIDATION_ERROR",
      "This user already owns the classroom.",
    );
  }

  const membership = await prisma.classroomMembership.upsert({
    where: { classroomId_userId: { classroomId, userId: user.id } },
    create: {
      classroomId,
      userId: user.id,
      role: ClassroomMembershipRole.TEACHER,
      status: ClassroomMembershipStatus.ACTIVE,
    },
    update: { role: ClassroomMembershipRole.TEACHER, status: ClassroomMembershipStatus.ACTIVE },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return {
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    joinedAt: membership.joinedAt,
  };
}
