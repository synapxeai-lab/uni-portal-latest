import type { SessionUser } from "@portal/shared/auth";

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate` for a request carrying a live session. */
      user?: SessionUser;
      sessionId?: string;
      mustChangePassword?: boolean;
      /** Viewer's IANA time zone from the X-Time-Zone header (UTC fallback). */
      timeZone: string;
    }
  }
}

export {};
