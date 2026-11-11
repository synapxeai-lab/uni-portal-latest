import { z } from "zod";

export const createCommentSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  announcementId: z.string().uuid("Invalid announcement id."),
  content: z
    .string()
    .trim()
    .min(1, "Comment can't be empty.")
    .max(2000, "Comment must be at most 2000 characters."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid("Invalid comment id."),
});
