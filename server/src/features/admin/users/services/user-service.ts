import type { SessionUser } from "@/auth/session";
import { generateTemporaryPassword } from "@/lib/auth/generate-password";
import { passwordFields } from "@/lib/auth/password";
import { decryptPassword } from "@/lib/auth/password-vault";
import * as people from "@/features/academics/services/people-service";
import { badRequest } from "@/http/errors";
import { recordAuditEvent } from "@/lib/audit-log";
import { getPasswordPolicyViolations } from "@/lib/password-policy";
import { getSystemSettings } from "@/lib/system-settings";
import { deleteAccount } from "@/lib/delete-account";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ActivityAction, UserRole, UserStatus } from "@/generated/prisma/enums";

import { AdminUserServiceError } from "../lib/errors";
import type {
  AdminUserDetail,
  AdminUserSummary,
  CreatedUserResult,
  ListUsersParams,
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
  teacherProfile: { select: { id: true } },
  studentProfile: { select: { id: true } },
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
    // Teachers and students need their academic record (Teachers / Students
    // pages) before their courses, registration and fees work.
    academicRecord:
      user.role === "ADMIN" ? null : Boolean(user.teacherProfile ?? user.studentProfile),
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
      // Unlocking (back to Active) starts the wrong-password count afresh, so one
      // more typo doesn't lock the account again straight away.
      ...(status === UserStatus.ACTIVE ? { failedLoginAttempts: 0, lockedAt: null } : {}),
    },
    select: summarySelect,
  });

  return toSummary(user);
}

/**
 * The admin sets a user's password to one they choose ("Change password" on
 * the Users page). It must meet the password policy. The user signs in with it
 * straight away - no forced change - and the wrong-password count starts afresh.
 */
export async function setPassword(
  userId: string,
  password: string,
  actor: SessionUser,
): Promise<void> {
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

  const violations = getPasswordPolicyViolations(password, await getSystemSettings());
  if (violations.length) {
    throw badRequest(violations[0], { password: violations });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(await passwordFields(password)),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      // A pending forced change is satisfied by the new password.
      ...(existing.status === UserStatus.PENDING_PASSWORD_CHANGE ? { status: UserStatus.ACTIVE } : {}),
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    action: ActivityAction.PASSWORD_RESET,
    entityType: "User",
    entityId: userId,
    targetLabel: userTargetLabel(existing),
  });
}

/**
 * Permanently deletes an account (lib/delete-account.ts). A student or teacher
 * record linked to it is deleted too, through the people service, so their
 * registrations and classes stay in sync. The acting admin takes over the
 * course classrooms and teaching material that must outlive the account.
 * Returns the ids of classrooms that changed.
 */
export async function deleteUser(userId: string, actor: SessionUser): Promise<string[]> {
  if (userId === actor.id) {
    throw new AdminUserServiceError("CANNOT_MODIFY_SELF", "You can't delete your own account.");
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: { select: { id: true } },
      teacherProfile: { select: { id: true } },
    },
  });
  if (!existing) {
    throw new AdminUserServiceError("NOT_FOUND", "User not found.");
  }

  let classroomIds: string[] = [];
  if (existing.studentProfile) {
    await people.deleteStudent(existing.studentProfile.id, actor.id);
  } else if (existing.teacherProfile) {
    await people.deleteTeacher(existing.teacherProfile.id, actor.id);
  } else {
    classroomIds = await deleteAccount(userId, actor.id);
  }

  await recordAuditEvent({
    actorId: actor.id,
    action: ActivityAction.DELETED,
    entityType: "User",
    entityId: userId,
    targetLabel: userTargetLabel(existing),
    metadata: { role: existing.role },
  });

  return classroomIds;
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
