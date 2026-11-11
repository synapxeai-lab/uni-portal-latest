import type { SessionUser } from "@portal/shared/auth";

import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma/enums";

// Mirrors the exact set of statuses login itself allows through - a JWT issued
// while ACTIVE must stop working the moment an admin sets the account to
// INACTIVE/ARCHIVED/SUSPENDED/LOCKED, not just block a fresh login.
// PENDING_PASSWORD_CHANGE stays allowed so the forced change-password flow
// still has a live session to act on.
const SESSION_ALLOWED_STATUSES: UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.PENDING_PASSWORD_CHANGE,
];

export interface ResolvedSession {
  user: SessionUser;
  sessionId: string;
  mustChangePassword: boolean;
  expiresAt: Date;
}

export async function loadSession(
  tokenId: string,
  userId: string,
): Promise<ResolvedSession | null> {
  const row = await prisma.userLoginSession.findUnique({
    where: { tokenId },
    select: {
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          avatarUrl: true,
          role: true,
          status: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!row || row.userId !== userId || row.revokedAt) {
    return null;
  }
  if (!SESSION_ALLOWED_STATUSES.includes(row.user.status)) {
    return null;
  }

  return {
    sessionId: tokenId,
    expiresAt: row.expiresAt,
    mustChangePassword: row.user.mustChangePassword,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image ?? row.user.avatarUrl ?? null,
      role: row.user.role,
    },
  };
}

/**
 * Resolves a verified JWT to its live session: the UserLoginSession row must
 * exist, be unrevoked and unexpired, and the account must still be allowed to
 * sign in. This is what enforces "Terminate Session" for otherwise stateless
 * JWTs. The lookup is cached briefly per session; anything that changes it
 * (sign out, terminate, status/role/avatar/password change) invalidates the
 * user's tag, so the change applies on the very next request.
 */
export async function resolveSession(
  tokenId: string,
  userId: string,
): Promise<ResolvedSession | null> {
  const session = await cached(
    `session:${tokenId}`,
    { ttl: CacheTtl.SESSION, tags: [CacheTags.user(userId), "sessions"] },
    () => loadSession(tokenId, userId),
  );

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return session;
}
