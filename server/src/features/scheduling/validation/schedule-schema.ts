import { z } from "zod";

import { isIsoInstant } from "@/lib/datetime/format";

export const contentTypeSchema = z.enum(["announcement", "assignment", "material"]);

export const contentIdentifierSchema = z.object({
  contentType: contentTypeSchema,
  contentId: z.string().uuid("Invalid content id."),
});

export const scheduleContentSchema = contentIdentifierSchema.extend({
  scheduledFor: z
    .string()
    .min(1, "Pick a date and time.")
    .refine(isIsoInstant, { message: "Invalid date." }),
});
