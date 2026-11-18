import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { recordAuditEvent } from "@/lib/audit-log";
import { cache } from "@/lib/cache/tagged-cache";
import { invalidateAdmin } from "@/lib/cache/tags";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { signSessionToken } from "@/lib/auth/tokens";
import { ActivityAction, UserRole, UserStatus } from "@/generated/prisma/enums";

// After this many consecutive failed attempts, the account is auto-locked
// (UserStatus.LOCKED) until an admin sets it back to Active from /admin/users.
// Admins are never auto-locked: the whole institute depends on them signing in,
// and a locked admin could only be recovered from the server. Their failed
// attempts are still recorded (LoginAttempt) for the audit trail.
export const FAILED_LOGIN_LOCK_THRESHOLD = 8;
// From this many attempts left (i.e. from the 3rd wrong password), a wrong
// password says how many remain.
const WARN_WHEN_ATTEMPTS_LEFT = 5;
// Wrong passwords only add up while they come close together: if the previous
// wrong password was longer ago than this, the count starts again at 1.
const FAILED_LOGIN_WINDOW_MS = 15 * 60_000;

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
 * Why a sign-in was refused. Unknown emails, wrong passwords and inactive
 * accounts are all INVALID_CREDENTIALS; only a locked account says so (with
 * the attempt that locks it), and a wrong password says how many tries are
 * left once few remain - so a user knows to stop before being locked out.
 */
export type LoginFailure =
  | { reason: "INVALID_CREDENTIALS"; attemptsLeft?: number }
  | { reason: "ACCOUNT_LOCKED" };

/** Verifies credentials and opens a session, or says why it refused. */
export async function login(
  rawEmail: string,
  password: string,
  context: LoginContext,
): Promise<LoginSuccess | LoginFailure> {
  const invalid: LoginFailure = { reason: "INVALID_CREDENTIALS" };
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
    return invalid;
  }

  if (user.status === UserStatus.LOCKED) {
    await recordAttempt(false);
    return { reason: "ACCOUNT_LOCKED" };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    // The previous wrong password, read before this one is recorded.
    const previousFailure = await prisma.loginAttempt.findFirst({
      where: { userId: user.id, succeeded: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    await recordAttempt(false);

    if (user.role === UserRole.ADMIN) {
      return invalid;
    }

    const recent =
      previousFailure !== null && Date.now() - previousFailure.createdAt.getTime() <= FAILED_LOGIN_WINDOW_MS;
    const failedLoginAttempts = (recent ? user.failedLoginAttempts : 0) + 1;
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

    if (shouldLock) {
      return { reason: "ACCOUNT_LOCKED" };
    }
    const attemptsLeft = FAILED_LOGIN_LOCK_THRESHOLD - failedLoginAttempts;
    return user.status === UserStatus.ACTIVE && attemptsLeft <= WARN_WHEN_ATTEMPTS_LEFT
      ? { reason: "INVALID_CREDENTIALS", attemptsLeft }
      : invalid;
  }

  // Only ACTIVE and PENDING_PASSWORD_CHANGE accounts may sign in; the latter
  // is allowed through so the user can be routed to the forced
  // change-password flow rather than being locked out entirely.
  if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_PASSWORD_CHANGE) {
    await recordAttempt(false);
    return invalid;
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
