/**
 * Errors a handler can throw to produce a specific HTTP response. The error
 * middleware turns them into the shared ActionResult error shape.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fieldErrors?: Partial<Record<string, string[]>>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class AuthError extends HttpError {
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(code === "UNAUTHENTICATED" ? 401 : 403, message, code);
    this.name = "AuthError";
  }
}

export function badRequest(message: string, fieldErrors?: Partial<Record<string, string[]>>) {
  return new HttpError(400, message, "VALIDATION", fieldErrors);
}

export function notFound(message = "Not found.") {
  return new HttpError(404, message, "NOT_FOUND");
}

/** Maps a domain service error code (NOT_FOUND, FORBIDDEN, ...) to an HTTP status. */
export function statusForCode(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "UNAUTHENTICATED":
      return 401;
    case "CONFLICT":
    case "ALREADY_MEMBER":
    case "DUPLICATE":
      return 409;
    default:
      return 400;
  }
}

/** A feature service's domain error (ClassroomServiceError, ...): a safe message plus a code. */
export function isServiceError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    error.name.endsWith("ServiceError") &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
