import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

import { resolveTimeZone, TIME_ZONE_HEADER } from "@portal/shared/datetime/time-zone";

import { env, isProduction } from "@/config/env";
import { cacheBypass } from "@/lib/cache/tagged-cache";
import { HttpError, isServiceError, statusForCode } from "@/http/errors";
import { AvatarValidationError } from "@/lib/storage/avatar-service";
import { CoverImageValidationError } from "@/lib/storage/cover-image-service";
import { FileValidationBatchError } from "@/lib/storage/file-service";

/** req.timeZone - the viewer's zone, used to read wall-clock form inputs. */
export const timeZone: RequestHandler = (req, _res, next) => {
  req.timeZone = resolveTimeZone(req.get(TIME_ZONE_HEADER));
  next();
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for the cookie-authenticated API. The session cookie is
 * SameSite=Lax already; on top of that every state-changing request must
 * carry the X-Requested-With header the SPA's axios client always sends - a
 * cross-site form or <img> can't set custom headers, and a cross-site fetch
 * that tries is stopped by CORS preflight (this API allows no CORS).
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  if (req.get("x-requested-with") !== "portal") {
    return next(new HttpError(403, "Cross-site request blocked.", "CSRF"));
  }
  next();
};

/**
 * Latency budget instrumentation: every API response carries a Server-Timing
 * header (visible in the browser's network panel) and anything slower than
 * SLOW_REQUEST_MS is logged.
 */
export const timing: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  const originalWriteHead = res.writeHead;
  res.writeHead = function writeHead(
    this: typeof res,
    ...args: Parameters<typeof originalWriteHead>
  ) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      res.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
    }
    if (ms > env.SLOW_REQUEST_MS) {
      console.warn(`[slow] ${req.method} ${req.originalUrl} ${ms.toFixed(1)}ms`);
    }
    return originalWriteHead.apply(this, args);
  } as typeof res.writeHead;
  next();
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ status: "error", message: "Not found.", code: "NOT_FOUND" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      status: "error",
      message: error.message,
      code: error.code,
      fieldErrors: error.fieldErrors,
    });
    return;
  }

  // Domain errors thrown by feature services (ClassroomServiceError,
  // AssignmentServiceError, ...) carry a user-facing message and a code -
  // the old Server Actions returned exactly that message to the client.
  if (isServiceError(error)) {
    res.status(statusForCode(error.code)).json({
      status: "error",
      message: error.message,
      code: error.code,
    });
    return;
  }

  // Upload validation failures - their messages name the offending file.
  if (
    error instanceof FileValidationBatchError ||
    error instanceof AvatarValidationError ||
    error instanceof CoverImageValidationError
  ) {
    res.status(400).json({ status: "error", message: error.message, code: "INVALID_FILE" });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "That file is too large."
        : "The upload could not be processed.";
    res.status(400).json({ status: "error", message, code: error.code });
    return;
  }

  // Malformed JSON body.
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ status: "error", message: "Malformed request body." });
    return;
  }

  console.error(error);
  res.status(500).json({ status: "error", message: "Something went wrong. Please try again." });
};

/**
 * Development aid for latency measurement: `X-Cache-Bypass: 1` makes every
 * cached read of the request go to the database (scripts/latency.ts uses it
 * to report cold, uncached timings). Ignored in production.
 */
export const cacheBypassHeader: RequestHandler = (req, _res, next) => {
  if (!isProduction && req.get("x-cache-bypass") === "1") {
    cacheBypass.run(true, next);
    return;
  }
  next();
};
