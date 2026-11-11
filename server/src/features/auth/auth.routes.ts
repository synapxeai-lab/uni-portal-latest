import { Router } from "express";

import { loginSchema, type SessionResponse } from "@portal/shared/auth";

import { badRequest, HttpError } from "@/http/errors";
import { requireAuth } from "@/middleware/auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/tokens";
import { getSystemSettings } from "@/lib/system-settings";
import { getUnreadCount } from "@/features/notifications/services/notification-service";

import * as authService from "./auth.service";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const result = await authService.login(parsed.data.email, parsed.data.password, {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  if (!result) {
    throw new HttpError(401, "Incorrect email or password.", "INVALID_CREDENTIALS");
  }

  res.cookie(SESSION_COOKIE, result.token, sessionCookieOptions(result.maxAgeMs));
  res.json({ status: "success", data: undefined });
});

authRouter.post("/logout", async (req, res) => {
  if (req.sessionId) {
    await authService.logout(req.sessionId);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ status: "success", data: undefined });
});

/** Public branding for the signed-out pages (tab title on /login). */
authRouter.get("/config", async (_req, res) => {
  const settings = await getSystemSettings();
  res.set("Cache-Control", "public, max-age=60").json({ platformName: settings.platformName });
});

/**
 * Everything the app shell needs on load, in one round trip: who is signed
 * in, whether a password change is pending, the platform name and the unread
 * notification badge.
 */
authRouter.get("/session", requireAuth, async (req, res) => {
  const user = req.user!;
  const [settings, unreadNotificationCount] = await Promise.all([
    getSystemSettings(),
    getUnreadCount(user.id),
  ]);

  const body: SessionResponse = {
    user,
    mustChangePassword: Boolean(req.mustChangePassword),
    platformName: settings.platformName,
    unreadNotificationCount,
  };
  res.set("Cache-Control", "no-store").json(body);
});
