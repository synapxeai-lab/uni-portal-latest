import type { SessionUser } from "@/auth/session";
import { generateTemporaryPassword } from "@/lib/auth/generate-password";
import { passwordFields } from "@/lib/auth/password";
import { decryptPassword } from "@/lib/auth/password-vault";
import { recordAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ActivityAction, UserRole, UserStatus } from "@/generated/prisma/enums";

import { AdminUserServiceError } from "../lib/errors";
import type {
  AdminUserDetail,
  AdminUserSummary,
  CreatedUserResult,
  ListUsersParams,
  ResetPasswordResult,
  UsersPage,
} from "../types";
import type { CreateUserInput, UpdateUserInput } from "../validation/user-schema";

const DEFAULT_PAGE_SIZE = 10;

const summarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  image: true,
  passwordEnc: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserSummaryRow = Prisma.UserGetPayload<{ select: typeof summarySelect }>;

function toSummary(user: UserSummaryRow): AdminUserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    image: user.image,
    hasViewablePassword: user.passwordEnc !== null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toOrderBy(
  sortField: ListUsersParams["sortField"],
  sortDir: NonNullable<ListUsersParams["sortDir"]>,
): Prisma.UserOrderByWithRelationInput {
  switch (sortField) {
    case "name":
      return { name: sortDir };
    case "email":
      return { email: sortDir };
    case "role":
      return { role: sortDir };
    case "status":
      return { status: sortDir };
    default:
      return { createdAt: sortDir };
  }
}

export async function listUsers(params: ListUsersParams): Promise<UsersPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const sortDir = params.sortDir ?? "desc";

  const where: Prisma.UserWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: summarySelect,
      orderBy: toOrderBy(params.sortField, sortDir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(toSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...summarySelect,
      archivedAt: true,
      emailVerified: true,
      _count: { select: { ownedClassrooms: true, classroomMemberships: true } },
    },
  });

  if (!user) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  return {
    ...toSummary(user),
    archivedAt: user.archivedAt,
    emailVerified: user.emailVerified,
    ownedClassroomCount: user._count.ownedClassrooms,
    classroomMembershipCount: user._count.classroomMemberships,
  };
}

async function assertEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== excludeUserId) {
    throw new AdminUserServiceError("DUPLICATE_EMAIL", "A user with this email already exists.");
  }
}

function userTargetLabel(user: { name: string; email: string }): string {
  return `${user.name} (${user.email})`;
}

export async function createUser(
  input: CreateUserInput,
  actor: SessionUser,
): Promise<CreatedUserResult> {
  await assertEmailAvailable(input.email);

  const temporaryPassword = generateTemporaryPassword();
  const passwordData = await passwordFields(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      ...passwordData,
      status: UserStatus.ACTIVE,
      // Admin-created accounts always start with a system-generated password,
      // so the new user is required to set their own on first sign-in.
      mustChangePassword: true,
    },
    select: summarySelect,
  });

  await recordAuditEvent({
    actorId: actor.id,
    action: ActivityAction.CREATED,
    entityType: "User",
    entityId: user.id,
    targetLabel: userTargetLabel(user),
    metadata: { role: user.role },
  });

  return { user: toSummary(user), temporaryPassword };
}

export async function updateUser(
  userId: string,
  input: Omit<UpdateUserInput, "userId">,
  actor: SessionUser,
): Promise<AdminUserSummary> {
  if (userId === actor.id && input.role !== UserRole.ADMIN) {
    throw new AdminUserServiceError("CANNOT_MODIFY_SELF", "You can't change your own role.");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  await assertEmailAvailable(input.email, userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, email: input.email, role: input.role },
    select: summarySelect,
  });

  // Role changes are tracked as their own distinct audit event rather than a
  // generic "updated" - it's the more significant of the two when both occur
  // in the same submission.
  if (existing.role !== input.role) {
    await recordAuditEvent({
      actorId: actor.id,
      action: ActivityAction.ROLE_CHANGED,
      entityType: "User",
      entityId: user.id,
      targetLabel: userTargetLabel(user),
      metadata: { fromRole: existing.role, toRole: input.role },
    });
  } else {
    await recordAuditEvent({
      actorId: actor.id,
      action: ActivityAction.UPDATED,
      entityType: "User",
      entityId: user.id,
      targetLabel: userTargetLabel(user),
      metadata: { name: input.name, email: input.email },
    });
  }

  return toSummary(user);
}

export async function setUserStatus(
  userId: string,
  status: Exclude<UserStatus, "PENDING_PASSWORD_CHANGE">,
  actor: SessionUser,
): Promise<AdminUserSummary> {
  if (userId === actor.id) {
    throw new AdminUserServiceError(
      "CANNOT_MODIFY_SELF",
      "You can't change your own account status.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      archivedAt: status === UserStatus.ARCHIVED ? new Date() : null,
    },
    select: summarySelect,
  });

  if (status === UserStatus.SUSPENDED) {
    await recordAuditEvent({
      actorId: actor.id,
      action: ActivityAction.SUSPENDED,
      entityType: "User",
      entityId: user.id,
      targetLabel: userTargetLabel(user),
      metadata: { previousStatus: existing.status },
    });
  }

  return toSummary(user);
}

export async function resetPassword(
  userId: string,
  actor: SessionUser,
): Promise<ResetPasswordResult> {
  if (userId === actor.id) {
    throw new AdminUserServiceError(
      "CANNOT_MODIFY_SELF",
      'Use "Change password" in your account menu to change your own password.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  if (existing.status === UserStatus.ARCHIVED) {
    throw new AdminUserServiceError(
      "VALIDATION_ERROR",
      "Reactivate this user before resetting their password.",
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordData = await passwordFields(temporaryPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { ...passwordData, mustChangePassword: true },
  });

  await recordAuditEvent({
    actorId: actor.id,
    action: ActivityAction.PASSWORD_RESET,
    entityType: "User",
    entityId: userId,
    targetLabel: userTargetLabel(existing),
  });

  return { temporaryPassword };
}

export async function forcePasswordChange(userId: string, actor: SessionUser): Promise<void> {
  if (userId === actor.id) {
    throw new AdminUserServiceError(
      "CANNOT_MODIFY_SELF",
      'Use "Change password" in your account menu to change your own password.',
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  if (existing.status !== UserStatus.ACTIVE) {
    throw new AdminUserServiceError(
      "VALIDATION_ERROR",
      "Only active users can be required to change their password.",
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.PENDING_PASSWORD_CHANGE, mustChangePassword: true },
  });
}

/**
 * The user's current password, decrypted from the admin-viewable copy - the
 * University Portal's "show password" on the Users page. null when the
 * password was set before copies were kept (or under another key); the admin
 * resets it to get a viewable one.
 */
export async function viewPassword(userId: string): Promise<{ password: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordEnc: true } });
  if (!user) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }
  return { password: decryptPassword(user.passwordEnc) };
}
