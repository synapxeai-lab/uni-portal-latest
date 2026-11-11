import { z } from "zod";

export function optionalTrimmed(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    });
}

export const topicIdField = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine((value) => !value || z.string().uuid().safeParse(value).success, {
    message: "Invalid topic.",
  });
