import { z } from "zod";

import { isIsoInstant } from "@/lib/datetime/format";

/**
 * Shared create-time status + scheduledFor fields, reused by the
 * announcement, assignment, and material create schemas so each doesn't
 * redefine its own "scheduledFor is required (and must be a future date)
 * only when status is SCHEDULED" refinement.
 */
export const createContentStatusField = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]);

export const scheduledForField = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine((value) => !value || isIsoInstant(value), {
    message: "Invalid date.",
  });

export function refineScheduledFor<
  Shape extends { status: "DRAFT" | "SCHEDULED" | "PUBLISHED"; scheduledFor?: string },
>(data: Shape, ctx: z.RefinementCtx): void {
  if (data.status !== "SCHEDULED") {
    return;
  }

  if (!data.scheduledFor) {
    ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Pick a date and time." });
    return;
  }

  if (Date.parse(data.scheduledFor) <= Date.now()) {
    ctx.addIssue({
      code: "custom",
      path: ["scheduledFor"],
      message: "Scheduled publish time must be in the future.",
    });
  }
}
