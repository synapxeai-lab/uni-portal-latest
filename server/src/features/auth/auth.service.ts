import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { recordAuditEvent } from "@/lib/audit-log";
import { cache } from "@/lib/cache/tagged-cache";
import { invalidateAdmin } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { signSessionToken } from "@/lib/auth/tokens";
import { ActivityAction, UserStatus } from "@/generated/prisma/enums";

// After this many consecutive failed attempts, the account is auto-locked
// (UserStatus.LOCKED) until an admin sets it back to Active from /admin/users.
const FAILED_LOGIN_LOCK_THRESHOLD = 5;

// A real bcrypt hash (of a random string) compared against when the email is
// unknown, so a miss costs the same time as a wrong password and response
// timing can't be used to enumerate accounts.
const TIMING_DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

interface LoginContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginSuccess {
  token: string;
  maxAgeMs: number;
}

/**
 * Verifies credentials and opens a session. Returns null on any failure - the
 * caller always answers with the same generic message, so the response never
 * reveals whether the email exists or why the attempt was refused.
 */
export async function login(
  rawEmail: string,
  password: string,
  context: LoginContext,
): Promise<LoginSuccess | null> {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  async function recordAttempt(succeeded: boolean) {
    await prisma.loginAttempt.create({
      data: {
        email,
        userId: user?.id ?? null,
        succeeded,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  }

  if (!user?.passwordHash) {
    await bcrypt.compare(password, TIMING_DUMMY_HASH);
    await recordAttempt(false);
    return null;
  }

  if (user.status === UserStatus.LOCKED) {
    await recordAttempt(false);
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    await recordAttempt(false);

    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldLock =
      failedLoginAttempts >= FAILED_LOGIN_LOCK_THRESHOLD && user.status === UserStatus.ACTIVE;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        ...(shouldLock ? { status: UserStatus.LOCKED, lockedAt: new Date() } : {}),
      },
    });

    if (shouldLock) {
      // Self-attributed: the lock is system-triggered by this account's own
      // failed attempts, not by another actor.
      await recordAuditEvent({
        actorId: user.id,
        action: ActivityAction.LOCKED,
        entityType: "User",
        entityId: user.id,
        targetLabel: `${user.name} (${user.email})`,
        metadata: { failedLoginAttempts },
      });
    }
    invalidateAdmin();

    return null;
  }

  // Only ACTIVE and PENDING_PASSWORD_CHANGE accounts may sign in; the latter
  // is allowed through so the user can be routed to the forced
  // change-password flow rather than being locked out entirely.
  if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_PASSWORD_CHANGE) {
    await recordAttempt(false);
    return null;
  }

  // One UserLoginSession row per sign-in, keyed by the JWT's jti - this is
  // what makes a specific session listable and revocable ("Terminate
  // Session") even though the JWT itself is stateless.
  const settings = await getSystemSettings();
  const maxAgeMs = settings.sessionTimeoutMinutes * 60_000;
  const tokenId = randomUUID();

  await Promise.all([
    recordAttempt(true),
    user.failedLoginAttempts > 0
      ? prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } })
      : Promise.resolve(),
    prisma.userLoginSession.create({
      data: {
        userId: user.id,
        tokenId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: new Date(Date.now() + maxAgeMs),
      },
    }),
  ]);
  invalidateAdmin();

  return {
    token: signSessionToken({ sub: user.id, jti: tokenId }, Math.floor(maxAgeMs / 1000)),
    maxAgeMs,
  };
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.userLoginSession.updateMany({
    where: { tokenId: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  cache.invalidateTags("sessions");
  invalidateAdmin();
}
