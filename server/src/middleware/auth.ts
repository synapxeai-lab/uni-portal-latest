import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { SessionUser } from "@portal/shared/auth";

import { AuthError, HttpError } from "@/http/errors";
import { resolveSession } from "@/lib/auth/session";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/tokens";
import { UserRole } from "@/generated/prisma/enums";

/**
 * Attaches req.user when the request carries a valid JWT whose session row is
 * still live. Never rejects by itself - see requireAuth.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) {
    return next();
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return next();
  }

  try {
    const session = await resolveSession(payload.jti, payload.sub);
    if (session) {
      req.user = session.user;
      req.sessionId = session.sessionId;
      req.mustChangePassword = session.mustChangePassword;
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Routes a user with a pending forced password change may still call - the
// equivalent of the old proxy.ts redirect to /change-password.
const PASSWORD_CHANGE_ALLOWED = new Set([
  "/api/auth/session",
  "/api/auth/logout",
  "/api/account/password",
]);

/** Rejects unauthenticated requests with 401; enforces the forced password change. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    return next(new AuthError("UNAUTHENTICATED", "You must be signed in to do that."));
  }
  if (req.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(req.originalUrl.split("?")[0])) {
    return next(
      new HttpError(
        403,
        "You must change your password before continuing.",
        "PASSWORD_CHANGE_REQUIRED",
      ),
    );
  }
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError("UNAUTHENTICATED", "You must be signed in to do that."));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AuthError("FORBIDDEN", "You do not have permission to perform this action."));
    }
    next();
  };
}

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireTeacherOrAdmin = requireRole(UserRole.ADMIN, UserRole.TEACHER);

/** The signed-in user of a request that passed requireAuth. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) {
    throw new AuthError("UNAUTHENTICATED", "You must be signed in to do that.");
  }
  return req.user;
}
