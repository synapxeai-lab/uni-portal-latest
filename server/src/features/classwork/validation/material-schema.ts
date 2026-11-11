import { z } from "zod";

import {
  createContentStatusField,
  refineScheduledFor,
  scheduledForField,
} from "@/lib/scheduling/schedule-validation";

import { optionalTrimmed, topicIdField } from "./shared";

const urlField = z
  .string()
  .max(2000, "URL is too long.")
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine((value) => !value || /^https?:\/\/.+/i.test(value), {
    message: "URL must start with http:// or https://.",
  });

const baseMaterialSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  title: z
    .string()
    .trim()
    .min(1, "Title can't be empty.")
    .max(150, "Title must be at most 150 characters."),
  description: optionalTrimmed(2000, "Description"),
  url: urlField,
  topicId: topicIdField,
});

export const createMaterialSchema = baseMaterialSchema
  .extend({
    status: createContentStatusField,
    scheduledFor: scheduledForField,
  })
  .superRefine(refineScheduledFor);

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = baseMaterialSchema.extend({
  materialId: z.string().uuid("Invalid material id."),
});

export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const materialIdSchema = z.object({
  materialId: z.string().uuid("Invalid material id."),
});
