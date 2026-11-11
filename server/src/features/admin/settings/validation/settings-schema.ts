import { z } from "zod";

// Unchecked checkboxes are simply absent from FormData, not sent as "off" -
// so the field must accept undefined as well as the literal "on" a checked
// box submits.
// (`.optional()`, not a union with z.undefined(): in zod 4 only an optional
// schema may be missing from the object - the union form rejected every
// unchecked box.)
const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const updateSettingsSchema = z.object({
  platformName: z
    .string()
    .trim()
    .min(1, "Platform name is required.")
    .max(100, "Platform name must be at most 100 characters."),
  academicYear: z
    .string()
    .trim()
    .min(4, "Enter an academic year, e.g. 2025-2026.")
    .max(20, "Academic year must be at most 20 characters."),
  sessionTimeoutMinutes: z.coerce
    .number()
    .int("Must be a whole number of minutes.")
    .min(5, "Must be at least 5 minutes.")
    .max(1440, "Must be at most 1440 minutes (24 hours)."),
  maxUploadSizeMb: z.coerce
    .number()
    .int("Must be a whole number of megabytes.")
    .min(1, "Must be at least 1 MB.")
    .max(500, "Must be at most 500 MB."),
  defaultAllowComments: checkbox,
  defaultAllowMaterials: checkbox,
  defaultAllowAssignments: checkbox,
  notifyNewAssignment: checkbox,
  notifyNewMaterial: checkbox,
  notifyNewAnnouncement: checkbox,
  notifySubmissionReturned: checkbox,
  notifyPrivateComment: checkbox,
  minPasswordLength: z.coerce
    .number()
    .int("Must be a whole number of characters.")
    .min(6, "Must be at least 6 characters.")
    .max(72, "Must be at most 72 characters."),
  requirePasswordUppercase: checkbox,
  requirePasswordNumber: checkbox,
  requirePasswordSymbol: checkbox,
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
