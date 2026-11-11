import { generateTemporaryPassword } from "@/lib/auth/generate-password";
import { passwordFields } from "@/lib/auth/password";
import { invalidateUser } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@/generated/prisma/enums";

/**
 * Teacher and Student profiles each have a login (User). Admins never create
 * those by hand: adding a teacher/student creates (or links) the login, and
 * editing the profile's name/email carries over to it - as in the University
 * Portal, where the two were matched by email. Here they're linked by userId.
 */

export interface CreatedLogin {
  email: string;
  password: string;
}

/**
 * Links a profile to a login: an existing account with the same email and
 * role is linked as-is; otherwise a new one is created with a random password
 * (viewable by admins on the Users page). Returns the new credentials, or null
 * when an existing account was linked (or the email belongs to another role).
 */
export async function ensureLoginFor(
  profile: { name: string; email: string },
  role: UserRole,
): Promise<{ userId: string | null; login: CreatedLogin | null }> {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: profile.email, mode: "insensitive" } },
    include: { teacherProfile: { select: { id: true } }, studentProfile: { select: { id: true } } },
  });
  if (existing) {
    const alreadyLinked = role === UserRole.TEACHER ? existing.teacherProfile : existing.studentProfile;
    // Only an account of the same role, not yet linked to another profile, is reused.
    if (existing.role === role && !alreadyLinked) {
      return { userId: existing.id, login: null };
    }
    return { userId: null, login: null };
  }

  const password = generateTemporaryPassword(10);
  const user = await prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      role,
      status: UserStatus.ACTIVE,
      ...(await passwordFields(password)),
    },
  });
  return { userId: user.id, login: { email: profile.email, password } };
}

/** Carries a profile's name/email change over to its login (when the email is free). */
export async function syncLogin(userId: string | null, profile: { name: string; email: string }) {
  if (!userId) {
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return;
  }
  const data: { name?: string; email?: string } = {};
  if (profile.name !== user.name) {
    data.name = profile.name;
  }
  if (profile.email.toLowerCase() !== user.email.toLowerCase()) {
    const clash = await prisma.user.count({
      where: { email: { equals: profile.email, mode: "insensitive" }, NOT: { id: userId } },
    });
    if (!clash) {
      data.email = profile.email;
    }
  }
  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
    invalidateUser(userId);
  }
}

/**
 * When a profile is deleted its login is archived rather than deleted: the
 * account may own classrooms, posts and submissions that must keep their
 * author. Archiving signs it out on the very next request.
 */
export async function archiveLogin(userId: string | null) {
  if (!userId) {
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.ARCHIVED, archivedAt: new Date() },
  });
  invalidateUser(userId);
}
