import type { Request, Response } from "express";
import { z } from "zod";

import { badRequest, HttpError } from "@/http/errors";

/** An integer route param (academic ids are integers); 400 when it isn't one. */
export function intParam(req: Request, name: string, label = "ID"): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`Invalid ${label}.`);
  }
  return value;
}

/** An optional integer query param; undefined when absent, 400 when malformed. */
export function intQuery(req: Request, name: string): number | undefined {
  const raw = req.query[name];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw badRequest(`Invalid ${name}.`);
  }
  return value;
}

/** An optional string query param, trimmed; undefined when empty. */
export function strQuery(req: Request, name: string): string | undefined {
  const raw = req.query[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

/** A mutation's success response: `{ status: "success", data }`. */
export function done(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ status: "success", data });
}

export const notFoundError = (message: string) => new HttpError(404, message, "NOT_FOUND");
export const conflictError = (message: string) => new HttpError(409, message, "CONFLICT");

/**
 * Parses with an async-refining schema (e.g. a programme key that must exist);
 * a failure is a 400 carrying per-field messages, like parseInput.
 */
export async function parseInputAsync<T extends z.ZodType>(
  schema: T,
  data: unknown,
): Promise<z.output<T>> {
  const parsed = await schema.safeParseAsync(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const first = parsed.error.issues[0]?.message;
    throw badRequest(first ?? "Please fix the highlighted fields.", fieldErrors);
  }
  return parsed.data;
}
