import path from "node:path";

import compression from "compression";
import cookieParser from "cookie-parser";
import express, { Router } from "express";
import helmet from "helmet";

import { env } from "@/config/env";
import { authenticate, requireAdmin, requireAuth } from "@/middleware/auth";
import {
  cacheBypassHeader,
  csrfGuard,
  errorHandler,
  notFoundHandler,
  timeZone,
  timing,
} from "@/middleware/request-context";
import { classroomRouter } from "@/features/classroom/classroom.routes";
import { classworkRouter } from "@/features/classwork/classwork.routes";
import { dashboardRouter } from "@/features/dashboard/dashboard.routes";
import { calendarRouter } from "@/features/calendar/calendar.routes";
import { adminRouter } from "@/features/admin/admin.routes";
import { settingsRouter } from "@/features/admin/settings/settings.routes";
import { fileRouter } from "@/features/files/file.routes";
import { searchRouter } from "@/features/search/search.routes";
import { timetableRouter } from "@/features/timetable/timetable.routes";
import { submissionRouter } from "@/features/submissions/submission.routes";
import { schedulingRouter } from "@/features/scheduling/scheduling.routes";
import { streamRouter } from "@/features/stream/stream.routes";
import { accountRouter } from "@/features/account/account.routes";
import { avatarRouter } from "@/features/account/avatar.routes";
import { authRouter } from "@/features/auth/auth.routes";
import { notificationRouter } from "@/features/notifications/notification.routes";
import { structureRouter } from "@/features/academics/structure.routes";
import { peopleRouter } from "@/features/academics/people.routes";
import { offeringsRouter } from "@/features/academics/offerings.routes";
import { registrationRouter } from "@/features/academics/registration.routes";
import { attendanceRouter } from "@/features/academics/attendance.routes";
import { marksRouter } from "@/features/academics/marks.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Behind the Vite dev proxy / nginx / Railway edge - trust one hop so
  // req.ip is the client address recorded on login attempts and sessions.
  app.set("trust proxy", 1);
  // JSON responses are never served from a stale HTTP cache by default;
  // routes that are cacheable set Cache-Control explicitly.
  app.set("etag", false);

  app.use(timing);
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-origin" } }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  const api = Router();
  api.use(cacheBypassHeader);
  api.use(timeZone);
  api.use(csrfGuard);
  api.use(authenticate);

  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Public (signed-out) endpoints.
  api.use("/auth", authRouter);

  // Everything below requires a live session.
  api.use(requireAuth);
  api.use("/account", accountRouter);
  api.use("/avatars", avatarRouter);
  api.use("/classrooms", classroomRouter);
  api.use("/classrooms/:classroomId", streamRouter);
  api.use("/classrooms/:classroomId", classworkRouter);
  api.use("/classrooms/:classroomId/assignments/:assignmentId", submissionRouter);
  api.use("/files", fileRouter);
  api.use("/scheduling", schedulingRouter);
  api.use("/notifications", notificationRouter);
  api.use(dashboardRouter);
  api.use("/calendar", calendarRouter);
  api.use("/timetable", timetableRouter);
  api.use("/search", searchRouter);
  api.use(structureRouter);
  api.use(peopleRouter);
  api.use(offeringsRouter);
  api.use(registrationRouter);
  api.use(attendanceRouter);
  api.use(marksRouter);
  api.use("/admin/settings", requireAdmin, settingsRouter);
  api.use("/admin", requireAdmin, adminRouter);

  api.use(notFoundHandler);
  app.use("/api", api);

  // Production single-container mode: also serve the built React app, with
  // content-hashed assets cached forever and the SPA shell never cached.
  if (env.SERVE_CLIENT_DIR) {
    const clientDir = path.resolve(env.SERVE_CLIENT_DIR);
    app.use(
      "/assets",
      express.static(path.join(clientDir, "assets"), { immutable: true, maxAge: "1y" }),
    );
    app.use(express.static(clientDir, { index: false, maxAge: "1d" }));
    app.get("/{*splat}", (_req, res) => {
      res.set("Cache-Control", "no-cache").sendFile(path.join(clientDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
