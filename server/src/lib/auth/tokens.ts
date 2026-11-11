import jwt from "jsonwebtoken";

import { cookieSecure, env } from "@/config/env";

export const SESSION_COOKIE = "gcr_session";

export interface SessionTokenPayload {
  /** User id. */
  sub: string;
  /** UserLoginSession.tokenId - what makes this JWT revocable. */
  jti: string;
}

export function signSessionToken(payload: SessionTokenPayload, expiresInSeconds: number): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: payload.sub,
    jwtid: payload.jti,
    expiresIn: expiresInSeconds,
  });
}

/** Returns the payload of a valid, unexpired token - or null for anything else. */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || !decoded.sub || !decoded.jti) {
      return null;
    }
    return { sub: decoded.sub, jti: decoded.jti };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}
