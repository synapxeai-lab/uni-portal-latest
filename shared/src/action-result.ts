/**
 * The response contract of every mutation endpoint - the same shape the
 * Next.js Server Actions returned, so client forms (useActionState) keep
 * working unchanged. Error responses also carry a matching HTTP status.
 */
export type ActionResult<T = undefined> =
  | { status: "success"; data: T }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string[]>> };
