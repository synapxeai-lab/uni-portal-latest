import { z } from "zod";

export const inviteMemberSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255, "Email is too long."),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const cancelInvitationSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  invitationId: z.string().uuid("Invalid invitation id."),
});
