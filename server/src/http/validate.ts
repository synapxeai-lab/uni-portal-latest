import type { z } from "zod";

import { badRequest } from "./errors";

const FIX_FIELDS = "Please fix the highlighted fields.";

/** Parses a request payload; throws a 400 carrying per-field messages (the form shows them inline). */
export function parseInput<T extends z.ZodType>(
  schema: T,
  data: unknown,
  message = FIX_FIELDS,
): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw badRequest(message, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return parsed.data;
}

/** Like parseInput, but for ids in the URL - a bad id is just "not valid", no field errors. */
export function parseParams<T extends z.ZodType>(
  schema: T,
  data: unknown,
  message: string,
): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw badRequest(message);
  }
  return parsed.data;
}
