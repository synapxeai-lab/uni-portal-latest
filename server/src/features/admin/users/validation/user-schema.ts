import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be at most 100 characters.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(255, "Email must be at most 255 characters.");

const roleSchema = z.enum(["ADMIN", "TEACHER", "STUDENT"], {
  message: "Choose a valid role.",
});

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  userId: z.string().uuid("Invalid user id."),
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Only the statuses an admin can set directly via the status menu -
// PENDING_PASSWORD_CHANGE is exclusively driven by the force-password-change
// action, not a freely selectable target status.
export const setUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user id."),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]),
});

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
