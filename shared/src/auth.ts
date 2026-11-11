import { z } from "zod";

import type { UserRole } from "./enums";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Length/complexity are enforced against the platform's configured password
// policy on the server - this schema only checks shape.
export const changePasswordSchema = z
  .object({
    // Only required for a voluntary (non-forced) change - enforced by the
    // server, since "required" depends on the `forced` flag.
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(1, "Password is required.")
      .max(72, "Password must be at most 72 characters."),
    confirmPassword: z.string(),
    forced: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The signed-in user as every page sees it. */
export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
}

/** GET /api/auth/session - everything the app shell needs in one round trip. */
export interface SessionResponse {
  user: SessionUser;
  mustChangePassword: boolean;
  platformName: string;
  unreadNotificationCount: number;
}
