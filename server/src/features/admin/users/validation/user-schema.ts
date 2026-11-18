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

// The statuses an admin can set: Active (reactivate/restore/unlock) and
// Inactive (deactivate). Suspend did the same as deactivate and archive is
// replaced by deleting (DELETE /admin/users/:userId); SUSPENDED and ARCHIVED
// stay only for older accounts, which can be reactivated.
export const setUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user id."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const setPasswordSchema = z.object({
  userId: z.string().uuid("Invalid user id."),
  password: z.string().min(1, "Enter a password.").max(128, "Password must be at most 128 characters."),
});

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
