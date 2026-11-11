import type { SessionUser } from "@/auth/session";
import {
  notifyClassroomArchived,
  notifyClassroomCreated,
  notifyInvitationAccepted,
  notifyMemberJoined,
} from "@/features/notifications/services/notification-generator";
import { toSectionKey } from "@/features/timetable/lib/slots";
import { prisma } from "@/lib/prisma";
import {
  deleteClassroomCoverImage,
  uploadClassroomCoverImage,
} from "@/lib/storage/cover-image-service";
import { validateImage } from "@/lib/storage/validation";
import { getSystemSettings } from "@/lib/system-settings";
import { Prisma } from "@/generated/prisma/client";
import {
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  InvitationStatus,
  UserRole,
} from "@/generated/prisma/enums";

import { canManageClassroom } from "../lib/can-manage";
import { generateClassroomCode } from "../lib/generate-code";
import { ClassroomServiceError } from "../lib/errors";
import type { CreateClassroomInput, UpdateClassroomInput } from "../validation/classroom-schema";
import type { ClassroomMemberSummary, ClassroomRoster, ClassroomSummary } from "../types";

const MAX_CODE_ATTEMPTS = 5;

function classroomWithOwnerInclude() {
  return { owner: { select: { name: true } } } as const;
}

async function findClassroomWithOwnerByWhere(where: Prisma.ClassroomWhereUniqueInput) {
  return prisma.classroom.findUnique({ where, include: classroomWithOwnerInclude() });
}

type ClassroomWithOwner = NonNullable<Awaited<ReturnType<typeof findClassroomWithOwnerByWhere>>>;

function toClassroomSummary(
  classroom: ClassroomWithOwner,
  role: ClassroomMembershipRole,
): ClassroomSummary {
  return {
    id: classroom.id,
    title: classroom.title,
    section: classroom.section,
    subject: classroom.subject,
    room: classroom.room,
    description: classroom.description,
    code: classroom.code,
    hasCoverImage: classroom.coverImageUrl != null,
    status: classroom.status,
    ownerId: classroom.ownerId,
    ownerName: classroom.owner.name,
    role,
    createdAt: classroom.createdAt,
  };
}

function isUniqueCodeConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes("code")
  );
}

/**
 * Shared "does this classroom exist at all" check, reused by every mutation in
 * this feature (and by invitation-service) instead of each re-implementing the
 * same fetch + NOT_FOUND guard. Archived-state handling is deliberately left to
 * callers, since each one needs a different message for it (or, like removing/
 * leaving a member, doesn't block on it at all).
 */
export async function loadActiveClassroom(classroomId: string) {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  return classroom;
}

/**
 * The single server-side "is this classroom currently editable" check -
 * archived classrooms are read-only (Phase 14.3), so every content mutation
 * across classroom/stream/classwork/invitations calls this instead of
 * re-implementing its own `if (status === ARCHIVED) throw` branch. Never
 * rely on the UI hiding a button to enforce this - every service function
 * that creates, edits, or deletes classroom content calls this first.
 */
export function assertClassroomActive(
  classroom: { status: ClassroomStatus },
  message = "This class is archived and is now read-only.",
): void {
  if (classroom.status === ClassroomStatus.ARCHIVED) {
    throw new ClassroomServiceError("ARCHIVED", message);
  }
}

/**
 * Only OWNER/TEACHER/CO_TEACHER on this specific classroom (or a platform ADMIN) may
 * manage it - a global TEACHER role does not imply access to every classroom.
 */
export async function hasManagementAccess(
  classroomId: string,
  user: SessionUser,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
  });

  return (
    membership?.status === ClassroomMembershipStatus.ACTIVE && canManageClassroom(membership.role)
  );
}

export async function assertManagementAccess(
  classroomId: string,
  user: SessionUser,
): Promise<void> {
  if (!(await hasManagementAccess(classroomId, user))) {
    throw new ClassroomServiceError(
      "FORBIDDEN",
      "You do not have permission to manage this classroom.",
    );
  }
}

/** Any active membership (any role) - or a platform ADMIN - counts. */
export async function assertMembership(classroomId: string, user: SessionUser): Promise<void> {
  if (user.role === UserRole.ADMIN) {
    return;
  }

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
  });

  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError("FORBIDDEN", "You are not a member of this classroom.");
  }
}

/** Read-only roster: any active member (any role) may view it - same gate as the page itself. */
export async function getClassroomRoster(
  classroomId: string,
  user: SessionUser,
): Promise<ClassroomRoster> {
  await assertMembership(classroomId, user);

  const memberships = await prisma.classroomMembership.findMany({
    where: { classroomId, status: ClassroomMembershipStatus.ACTIVE },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, avatarUrl: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const teachers: ClassroomMemberSummary[] = [];
  const students: ClassroomMemberSummary[] = [];

  for (const membership of memberships) {
    const summary: ClassroomMemberSummary = {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      image: membership.user.image ?? membership.user.avatarUrl ?? null,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };

    if (canManageClassroom(membership.role)) {
      teachers.push(summary);
    } else {
      students.push(summary);
    }
  }

  return { teachers, students };
}

// Archived classrooms have their own dedicated list (listArchivedClassrooms,
// reached via "Archived classes") - excluded here so archiving a class
// actually removes it from the active list instead of just badging it there.
export async function listUserClassrooms(userId: string): Promise<ClassroomSummary[]> {
  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: ClassroomStatus.ACTIVE },
    },
    include: { classroom: { include: classroomWithOwnerInclude() } },
    orderBy: { classroom: { updatedAt: "desc" } },
  });

  return memberships.map((membership) => toClassroomSummary(membership.classroom, membership.role));
}

/**
 * Archived classrooms only - backs the "Archived classes" nav item. Platform
 * admins bypass membership and see every archived classroom, matching the
 * same ADMIN-bypass convention used by getClassroomForUser (a synthetic
 * TEACHER role, since admins aren't classroom members) and by the review
 * queue's manageable-classroom lookup.
 */
export async function listArchivedClassrooms(user: SessionUser): Promise<ClassroomSummary[]> {
  if (user.role === UserRole.ADMIN) {
    const classrooms = await prisma.classroom.findMany({
      where: { status: ClassroomStatus.ARCHIVED },
      include: classroomWithOwnerInclude(),
      orderBy: { updatedAt: "desc" },
    });

    return classrooms.map((classroom) =>
      toClassroomSummary(classroom, ClassroomMembershipRole.TEACHER),
    );
  }

  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId: user.id,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: ClassroomStatus.ARCHIVED },
    },
    include: { classroom: { include: classroomWithOwnerInclude() } },
    orderBy: { classroom: { updatedAt: "desc" } },
  });

  return memberships.map((membership) => toClassroomSummary(membership.classroom, membership.role));
}

/**
 * Count-only variant of listArchivedClassrooms - for dashboard stat tiles
 * that only need a number, not the full classroom+owner join. Same
 * ADMIN-bypass rule as every other archived-classroom lookup.
 */
export async function countArchivedClassrooms(user: SessionUser): Promise<number> {
  if (user.role === UserRole.ADMIN) {
    return prisma.classroom.count({ where: { status: ClassroomStatus.ARCHIVED } });
  }

  return prisma.classroomMembership.count({
    where: {
      userId: user.id,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: ClassroomStatus.ARCHIVED },
    },
  });
}

/**
 * Ids only, for cheaply scoping other aggregate queries (e.g. a student's
 * upcoming-deadlines lookup) to "classrooms this user is currently an
 * active member of" without pulling the full classroom+owner join.
 */
export async function listActiveClassroomIds(userId: string): Promise<string[]> {
  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: ClassroomStatus.ACTIVE },
    },
    select: { classroomId: true },
  });

  return memberships.map((membership) => membership.classroomId);
}

/**
 * Same scoping as listActiveClassroomIds (active membership, active
 * classroom - archived classrooms excluded), just with a title alongside
 * each id. Backs the Student To-do page's "All Classes" filter dropdown, in
 * one query rather than ids-then-a-second-lookup.
 */
export async function listActiveClassroomsForUser(
  userId: string,
): Promise<{ id: string; title: string }[]> {
  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: ClassroomStatus.ACTIVE },
    },
    select: { classroom: { select: { id: true, title: true } } },
    orderBy: { classroom: { title: "asc" } },
  });

  return memberships.map((membership) => membership.classroom);
}

export interface ClassroomSearchScope {
  /** Classrooms this user manages - full visibility, including drafts/scheduled content. */
  manageableClassroomIds: string[];
  /** Classrooms this user is only a plain member of - published-only content visibility. */
  memberOnlyClassroomIds: string[];
}

/**
 * The classroom scope for cross-classroom search (Phase 15.1) - unlike
 * listActiveClassroomIds/getManageableClassrooms (review-service), this
 * deliberately *includes* archived classrooms: archived content stays
 * readable (see Archived Classroom Experience), so it must stay findable.
 * Only DELETED classrooms are excluded. Platform admins bypass membership
 * and get every non-deleted classroom as "manageable" (full visibility),
 * matching the ADMIN-bypass convention used everywhere else.
 */
export async function getClassroomSearchScope(user: SessionUser): Promise<ClassroomSearchScope> {
  if (user.role === UserRole.ADMIN) {
    const classrooms = await prisma.classroom.findMany({
      where: { status: { not: ClassroomStatus.DELETED } },
      select: { id: true },
    });

    return {
      manageableClassroomIds: classrooms.map((classroom) => classroom.id),
      memberOnlyClassroomIds: [],
    };
  }

  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId: user.id,
      status: ClassroomMembershipStatus.ACTIVE,
      classroom: { status: { not: ClassroomStatus.DELETED } },
    },
    select: { classroomId: true, role: true },
  });

  const manageableClassroomIds: string[] = [];
  const memberOnlyClassroomIds: string[] = [];

  for (const membership of memberships) {
    (canManageClassroom(membership.role) ? manageableClassroomIds : memberOnlyClassroomIds).push(
      membership.classroomId,
    );
  }

  return { manageableClassroomIds, memberOnlyClassroomIds };
}

export async function getClassroomForUser(
  classroomId: string,
  user: SessionUser,
): Promise<ClassroomSummary> {
  const classroom = await findClassroomWithOwnerByWhere({ id: classroomId });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  if (user.role === UserRole.ADMIN) {
    return toClassroomSummary(classroom, ClassroomMembershipRole.TEACHER);
  }

  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: user.id } },
  });

  // Don't distinguish "doesn't exist" from "you can't see it" - avoids leaking existence.
  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  return toClassroomSummary(classroom, membership.role);
}

export async function createClassroom(
  ownerId: string,
  input: CreateClassroomInput,
  coverImage?: File,
): Promise<ClassroomSummary> {
  // Validated up front, before anything is created - an invalid cover image
  // should fail the whole create, not leave a classroom behind without one.
  if (coverImage) {
    const error = validateImage(coverImage);
    if (error) {
      throw new ClassroomServiceError("VALIDATION_ERROR", error.message);
    }
  }

  const platformDefaults = await getSystemSettings();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateClassroomCode();

    try {
      const classroom = await prisma.$transaction(async (tx) => {
        const created = await tx.classroom.create({
          data: {
            ownerId,
            title: input.title,
            section: input.section,
            subject: input.subject ?? null,
            description: input.description ?? null,
            code,
          },
          include: classroomWithOwnerInclude(),
        });

        await tx.classroomMembership.create({
          data: {
            classroomId: created.id,
            userId: ownerId,
            role: ClassroomMembershipRole.OWNER,
            status: ClassroomMembershipStatus.ACTIVE,
          },
        });

        // Every platform admin is auto-enrolled as a co-teacher on every new
        // classroom - visible in its roster, not just a background bypass
        // (admins already bypass management/visibility checks everywhere
        // regardless of membership; this is specifically about them being a
        // real, listed member). Excludes ownerId so an admin creating their
        // own classroom doesn't collide with the OWNER row just created above.
        const otherAdmins = await tx.user.findMany({
          where: { role: UserRole.ADMIN, id: { not: ownerId } },
          select: { id: true },
        });
        if (otherAdmins.length > 0) {
          await tx.classroomMembership.createMany({
            data: otherAdmins.map((admin) => ({
              classroomId: created.id,
              userId: admin.id,
              role: ClassroomMembershipRole.CO_TEACHER,
              status: ClassroomMembershipStatus.ACTIVE,
            })),
          });
        }

        // Every classroom gets a settings row seeded from the platform's
        // configured defaults, editable per-classroom afterward.
        await tx.classroomSettings.create({
          data: {
            classroomId: created.id,
            allowComments: platformDefaults.defaultAllowComments,
            allowMaterials: platformDefaults.defaultAllowMaterials,
            allowAssignments: platformDefaults.defaultAllowAssignments,
          },
        });

        return created;
      });

      // The storage key is namespaced by classroom id, so this can only
      // happen once the classroom (and its real id) exists - the upload
      // itself is an external write, so it necessarily happens outside the
      // transaction above, same accepted tradeoff as lesson attachments.
      let finalClassroom = classroom;
      if (coverImage) {
        const key = await uploadClassroomCoverImage(coverImage, classroom.id);
        finalClassroom = await prisma.classroom.update({
          where: { id: classroom.id },
          data: { coverImageUrl: key },
          include: classroomWithOwnerInclude(),
        });
      }

      await notifyClassroomCreated({
        classroomId: finalClassroom.id,
        classroomTitle: finalClassroom.title,
        creatorName: finalClassroom.owner.name,
      });

      return toClassroomSummary(finalClassroom, ClassroomMembershipRole.OWNER);
    } catch (error) {
      if (isUniqueCodeConflict(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new ClassroomServiceError(
    "CODE_GENERATION_FAILED",
    "Could not generate a unique class code. Please try again.",
  );
}

export async function updateClassroom(
  classroomId: string,
  user: SessionUser,
  input: Omit<UpdateClassroomInput, "classroomId">,
  coverImage?: File,
  removeCoverImage?: boolean,
): Promise<ClassroomSummary> {
  const classroom = await loadActiveClassroom(classroomId);
  assertClassroomActive(
    classroom,
    "This class is archived - restore it before editing its settings.",
  );
  await assertManagementAccess(classroomId, user);

  if (coverImage) {
    const error = validateImage(coverImage);
    if (error) {
      throw new ClassroomServiceError("VALIDATION_ERROR", error.message);
    }
  }

  // undefined = leave the existing cover untouched; null = clear it; a
  // string = replace it with a freshly-uploaded key.
  let coverImageUrl: string | null | undefined;
  if (coverImage) {
    coverImageUrl = await uploadClassroomCoverImage(coverImage, classroomId);
  } else if (removeCoverImage) {
    coverImageUrl = null;
  }

  // Timetable slots carry the classroom's normalized section so the database
  // itself can reject two classes in one section at the same time. When the
  // section changes, its existing slots/clashes follow it - and if that would
  // collide with a class already on the timetable there, the whole edit is
  // rejected rather than silently creating a double-booking.
  const sectionKey = toSectionKey(input.section);
  const sectionChanged = sectionKey !== toSectionKey(classroom.section);

  // Neither read depends on the other's result, so run them concurrently.
  const [updated, membership] = await Promise.all([
    prisma
      .$transaction(async (tx) => {
        const result = await tx.classroom.update({
          where: { id: classroomId },
          data: {
            title: input.title,
            section: input.section,
            subject: input.subject ?? null,
            description: input.description ?? null,
            ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
          },
          include: classroomWithOwnerInclude(),
        });

        if (sectionChanged) {
          await tx.timetableSlot.updateMany({ where: { classroomId }, data: { sectionKey } });
          await tx.timetableClash.updateMany({ where: { classroomId }, data: { sectionKey } });
        }

        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ClassroomServiceError(
            "VALIDATION_ERROR",
            "Can't move this class to that section: it would clash with a class already on the timetable there.",
          );
        }
        throw error;
      }),
    prisma.classroomMembership.findUnique({
      where: { classroomId_userId: { classroomId, userId: user.id } },
    }),
  ]);

  // Best-effort cleanup of the file the new one replaced/cleared - never
  // blocks the update itself from returning successfully.
  if (coverImageUrl !== undefined && classroom.coverImageUrl) {
    await deleteClassroomCoverImage(classroom.coverImageUrl).catch(() => {});
  }

  return toClassroomSummary(updated, membership?.role ?? ClassroomMembershipRole.TEACHER);
}

export async function archiveClassroom(classroomId: string, user: SessionUser): Promise<void> {
  const classroom = await loadActiveClassroom(classroomId);
  await assertManagementAccess(classroomId, user);

  await prisma.classroom.update({
    where: { id: classroomId },
    data: { status: ClassroomStatus.ARCHIVED },
  });

  await notifyClassroomArchived({
    classroomId,
    classroomTitle: classroom.title,
    archivedByName: user.name ?? "Someone",
  });
}

/**
 * Teacher-facing restore, distinct from the admin console's version
 * (admin/classrooms/services/classroom-admin-service.ts) - same effect, but
 * gated by assertManagementAccess (Owner/Teacher/Co-Teacher, or an Admin via
 * its existing bypass) rather than by the admin route itself. Permanently
 * deleting a classroom remains admin-only and lives exclusively in the admin
 * service - there is deliberately no teacher-facing delete path.
 */
export async function restoreClassroom(classroomId: string, user: SessionUser): Promise<void> {
  const classroom = await loadActiveClassroom(classroomId);
  await assertManagementAccess(classroomId, user);

  if (classroom.status !== ClassroomStatus.ARCHIVED) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "This class isn't archived.");
  }

  await prisma.classroom.update({
    where: { id: classroomId },
    data: { status: ClassroomStatus.ACTIVE },
  });
}

export async function joinClassroomByCode(
  user: SessionUser,
  code: string,
): Promise<ClassroomSummary> {
  // Case-insensitive: generated codes are lowercase, but codes can be stored or
  // typed in any case (e.g. seeded/legacy data), so match on either.
  const classroom = await prisma.classroom.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    include: classroomWithOwnerInclude(),
  });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "No class was found with that code.");
  }

  assertClassroomActive(
    classroom,
    "This class has been archived and is no longer accepting new members.",
  );

  const existingMembership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId: user.id } },
  });

  if (existingMembership?.status === ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError("ALREADY_ENROLLED", "You're already a member of this class.");
  }

  const membership = existingMembership
    ? await prisma.classroomMembership.update({
        where: { id: existingMembership.id },
        data: {
          status: ClassroomMembershipStatus.ACTIVE,
          role: ClassroomMembershipRole.STUDENT,
          joinedAt: new Date(),
        },
      })
    : await prisma.classroomMembership.create({
        data: {
          classroomId: classroom.id,
          userId: user.id,
          role: ClassroomMembershipRole.STUDENT,
          status: ClassroomMembershipStatus.ACTIVE,
        },
      });

  // If this join matches a pending invitation (by account or by email), mark
  // it accepted and notify the specific inviter - otherwise every other
  // manager just gets the generic "member joined" notice below.
  const memberName = user.name ?? "A new member";
  const matchedInvitation = await prisma.invitation.findFirst({
    where: {
      classroomId: classroom.id,
      status: InvitationStatus.PENDING,
      OR: [{ inviteeUserId: user.id }, ...(user.email ? [{ inviteeEmail: user.email }] : [])],
    },
  });

  if (matchedInvitation) {
    await prisma.invitation.update({
      where: { id: matchedInvitation.id },
      data: { status: InvitationStatus.ACCEPTED },
    });

    await notifyInvitationAccepted({
      inviterId: matchedInvitation.invitedById,
      classroomId: classroom.id,
      memberName,
      classroomTitle: classroom.title,
    });
  }

  await notifyMemberJoined({
    classroomId: classroom.id,
    classroomTitle: classroom.title,
    memberName,
    excludeUserIds: matchedInvitation ? [user.id, matchedInvitation.invitedById] : [user.id],
  });

  return toClassroomSummary(classroom, membership.role);
}

export async function leaveClassroom(userId: string, classroomId: string): Promise<void> {
  const membership = await prisma.classroomMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId } },
  });

  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError("NOT_A_MEMBER", "You are not a member of this class.");
  }

  if (membership.role === ClassroomMembershipRole.OWNER) {
    throw new ClassroomServiceError(
      "OWNER_CANNOT_LEAVE",
      "Classroom owners can't leave their own class. Archive it instead.",
    );
  }

  await prisma.classroomMembership.update({
    where: { id: membership.id },
    data: { status: ClassroomMembershipStatus.REMOVED },
  });
}

/**
 * Teacher-initiated removal of another member (student or co-teacher). Distinct
 * from leaveClassroom, which is self-service and has no management gate.
 */
export async function removeMember(
  classroomId: string,
  targetUserId: string,
  actor: SessionUser,
): Promise<void> {
  if (targetUserId === actor.id) {
    throw new ClassroomServiceError("VALIDATION_ERROR", 'Use "Leave class" to remove yourself.');
  }

  // Independent reads - the authorization check doesn't depend on the target's
  // membership row, so fetch both concurrently instead of one after the other.
  const [, membership] = await Promise.all([
    assertManagementAccess(classroomId, actor),
    prisma.classroomMembership.findUnique({
      where: { classroomId_userId: { classroomId, userId: targetUserId } },
    }),
  ]);

  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError(
      "NOT_A_MEMBER",
      "This person is not an active member of this class.",
    );
  }

  if (membership.role === ClassroomMembershipRole.OWNER) {
    throw new ClassroomServiceError("CANNOT_REMOVE_OWNER", "The classroom owner can't be removed.");
  }

  // Belt-and-suspenders on top of the owner check above: a classroom must
  // always retain at least one member who can manage it.
  if (canManageClassroom(membership.role)) {
    const managerCount = await prisma.classroomMembership.count({
      where: {
        classroomId,
        status: ClassroomMembershipStatus.ACTIVE,
        role: {
          in: [
            ClassroomMembershipRole.OWNER,
            ClassroomMembershipRole.TEACHER,
            ClassroomMembershipRole.CO_TEACHER,
          ],
        },
      },
    });

    if (managerCount <= 1) {
      throw new ClassroomServiceError(
        "CANNOT_REMOVE_LAST_TEACHER",
        "Every class needs at least one teacher - you can't remove the last one.",
      );
    }
  }

  await prisma.classroomMembership.update({
    where: { id: membership.id },
    data: { status: ClassroomMembershipStatus.REMOVED },
  });
}

/**
 * Changes a member's classroom role. Supports exactly three transitions:
 *   STUDENT -> CO_TEACHER            (promote)
 *   CO_TEACHER -> STUDENT            (demote)
 *   TEACHER | CO_TEACHER -> OWNER    (ownership transfer, owner-only, atomic)
 *
 * The OWNER role is never assigned or removed any other way - there is no
 * standalone "demote the owner" path, so an owner can only stop being owner
 * by transferring ownership to someone else in the same operation.
 */
export async function changeMemberRole(
  classroomId: string,
  targetUserId: string,
  newRole: ClassroomMembershipRole,
  actor: SessionUser,
): Promise<void> {
  if (targetUserId === actor.id) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "You can't change your own role here.");
  }

  // Independent reads - fetch the classroom and the target's membership
  // concurrently rather than one after the other.
  const [classroom, membership] = await Promise.all([
    loadActiveClassroom(classroomId),
    prisma.classroomMembership.findUnique({
      where: { classroomId_userId: { classroomId, userId: targetUserId } },
    }),
  ]);

  assertClassroomActive(classroom, "This class is archived and roles can't be changed.");

  await assertManagementAccess(classroomId, actor);

  if (!membership || membership.status !== ClassroomMembershipStatus.ACTIVE) {
    throw new ClassroomServiceError(
      "NOT_A_MEMBER",
      "This person is not an active member of this class.",
    );
  }

  const currentRole = membership.role;

  if (currentRole === newRole) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "This member already has that role.");
  }

  // The owner's role is untouchable through this generic path - see transfer
  // handling below, which is the only legitimate way it ever changes.
  if (currentRole === ClassroomMembershipRole.OWNER) {
    throw new ClassroomServiceError(
      "INVALID_ROLE_CHANGE",
      "Transfer ownership instead of changing the owner's role directly.",
    );
  }

  if (newRole === ClassroomMembershipRole.OWNER) {
    // Only the current owner (or a platform admin) may transfer ownership -
    // this is what makes "prevent multiple owners" and "owner can't demote
    // themselves without transferring" both hold: it's the one and only path
    // that ever assigns OWNER, and it always swaps the previous owner out atomically.
    if (classroom.ownerId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ClassroomServiceError(
        "FORBIDDEN",
        "Only the current owner can transfer ownership.",
      );
    }

    if (
      currentRole !== ClassroomMembershipRole.TEACHER &&
      currentRole !== ClassroomMembershipRole.CO_TEACHER
    ) {
      throw new ClassroomServiceError(
        "INVALID_ROLE_CHANGE",
        "Only an existing teacher or co-teacher can be promoted to owner.",
      );
    }

    await prisma.$transaction([
      prisma.classroom.update({ where: { id: classroomId }, data: { ownerId: targetUserId } }),
      prisma.classroomMembership.update({
        where: { id: membership.id },
        data: { role: ClassroomMembershipRole.OWNER },
      }),
      prisma.classroomMembership.update({
        where: { classroomId_userId: { classroomId, userId: classroom.ownerId } },
        data: { role: ClassroomMembershipRole.TEACHER },
      }),
    ]);
    return;
  }

  if (
    currentRole === ClassroomMembershipRole.STUDENT &&
    newRole === ClassroomMembershipRole.CO_TEACHER
  ) {
    await prisma.classroomMembership.update({
      where: { id: membership.id },
      data: { role: newRole },
    });
    return;
  }

  if (
    currentRole === ClassroomMembershipRole.CO_TEACHER &&
    newRole === ClassroomMembershipRole.STUDENT
  ) {
    await prisma.classroomMembership.update({
      where: { id: membership.id },
      data: { role: newRole },
    });
    return;
  }

  throw new ClassroomServiceError(
    "INVALID_ROLE_CHANGE",
    `Can't change role from ${currentRole} to ${newRole}.`,
  );
}
