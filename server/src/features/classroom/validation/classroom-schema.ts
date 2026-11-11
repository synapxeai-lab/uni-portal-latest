import { z } from "zod";

function optionalTrimmed(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    });
}

export const createClassroomSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Class name must be at least 2 characters.")
    .max(100, "Class name must be at most 100 characters."),
  section: z
    .string()
    .trim()
    .min(1, "Section is required.")
    .max(50, "Section must be at most 50 characters."),
  subject: optionalTrimmed(100, "Subject"),
  description: optionalTrimmed(2000, "Description"),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;

export const updateClassroomSchema = createClassroomSchema.extend({
  classroomId: z.string().uuid("Invalid classroom id."),
});

export type UpdateClassroomInput = z.infer<typeof updateClassroomSchema>;

export const joinClassroomSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(6, "Class codes are 6-8 characters.")
    .max(12, "That code looks too long.")
    .regex(/^[a-z0-9-]+$/, "Class codes only contain letters and numbers."),
});

export type JoinClassroomInput = z.infer<typeof joinClassroomSchema>;
