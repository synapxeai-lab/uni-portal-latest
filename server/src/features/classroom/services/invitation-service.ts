import type { SessionUser } from "@/auth/session";
import { notifyInvited } from "@/features/notifications/services/notification-generator";
import { prisma } from "@/lib/prisma";
import {
  ClassroomMembershipStatus,
  InvitationStatus,
  InvitationType,
} from "@/generated/prisma/enums";

import {
  assertClassroomActive,
  assertManagementAccess,
  loadActiveClassroom,
} from "./classroom-service";
import { ClassroomServiceError } from "../lib/errors";
import type { PendingInvitation } from "../types";

function invitationWithInviterInclude() {
  return { invitedBy: { select: { name: true } } } as const;
}

function toPendingInvitation(invitation: {
  id: string;
  inviteeEmail: string;
  createdAt: Date;
  invitedBy: { name: string };
}): PendingInvitation {
  return {
    id: invitation.id,
    email: invitation.inviteeEmail,
    invitedByName: invitation.invitedBy.name,
    createdAt: invitation.createdAt,
  };
}

async function assertClassroomAcceptsInvitations(classroomId: string) {
  const classroom = await loadActiveClassroom(classroomId);
  assertClassroomActive(classroom, "This class is archived and can't accept new invitations.");
  return classroom;
}

export async function listPendingInvitations(
  classroomId: string,
  user: SessionUser,
): Promise<PendingInvitation[]> {
  await assertManagementAccess(classroomId, user);

  const invitations = await prisma.invitation.findMany({
    where: { classroomId, status: InvitationStatus.PENDING },
    include: invitationWithInviterInclude(),
    orderBy: { createdAt: "desc" },
  });

  return invitations.map(toPendingInvitation);
}

export async function inviteMember(
  classroomId: string,
  user: SessionUser,
  email: string,
): Promise<PendingInvitation> {
  const classroom = await assertClassroomAcceptsInvitations(classroomId);
  await assertManagementAccess(classroomId, user);

  // Independent reads - whether this email already belongs to a user and
  // whether it already has a pending invitation don't depend on each other.
  const [existingUser, existingInvitation] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.invitation.findFirst({
      where: { classroomId, inviteeEmail: email, status: InvitationStatus.PENDING },
    }),
  ]);

  if (existingInvitation) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "An invitation is already pending for this email.",
    );
  }

  if (existingUser) {
    const membership = await prisma.classroomMembership.findUnique({
      where: { classroomId_userId: { classroomId, userId: existingUser.id } },
    });

    if (membership?.status === ClassroomMembershipStatus.ACTIVE) {
      throw new ClassroomServiceError(
        "ALREADY_ENROLLED",
        "This person is already a member of this class.",
      );
    }
  }

  const created = await prisma.invitation.create({
    data: {
      classroomId,
      invitedById: user.id,
      inviteeUserId: existingUser?.id ?? null,
      inviteeEmail: email,
      type: InvitationType.EMAIL,
      status: InvitationStatus.PENDING,
    },
    include: invitationWithInviterInclude(),
  });

  // Only when the invite matched a real account - an unregistered email has
  // nobody to notify yet, so the inviter falls back to sharing the class
  // code/link themselves (see InvitationDialog).
  if (existingUser) {
    await notifyInvited({
      inviteeUserId: existingUser.id,
      classroomId,
      classroomTitle: classroom.title,
      classroomCode: classroom.code,
      inviterName: user.name ?? "Someone",
    });
  }

  return toPendingInvitation(created);
}

export async function cancelInvitation(
  classroomId: string,
  invitationId: string,
  user: SessionUser,
): Promise<void> {
  await assertManagementAccess(classroomId, user);

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });

  if (!invitation || invitation.classroomId !== classroomId) {
    throw new ClassroomServiceError("NOT_FOUND", "Invitation not found.");
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ClassroomServiceError("VALIDATION_ERROR", "This invitation is no longer pending.");
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: InvitationStatus.REVOKED },
  });
}
