import { z } from "zod";

const textAnswerField = z
  .string()
  .max(20_000, "Your response must be at most 20000 characters.")
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export const submissionMutationSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  assignmentId: z.string().uuid("Invalid assignment id."),
  textAnswer: textAnswerField,
});

export type SubmissionMutationInput = z.infer<typeof submissionMutationSchema>;

export const classroomAssignmentIdSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  assignmentId: z.string().uuid("Invalid assignment id."),
});

export const removeAttachmentSchema = z.object({
  submissionId: z.string().uuid("Invalid submission id."),
  fileAttachmentId: z.string().uuid("Invalid attachment id."),
});

export const studentSubmissionIdSchema = classroomAssignmentIdSchema.extend({
  studentId: z.string().uuid("Invalid student id."),
});

export const privateCommentSchema = studentSubmissionIdSchema.extend({
  content: z
    .string()
    .trim()
    .min(1, "Comment can't be empty.")
    .max(5000, "Comment must be at most 5000 characters."),
});

export const deletePrivateCommentSchema = studentSubmissionIdSchema.extend({
  commentId: z.string().uuid("Invalid comment id."),
});

export const gradeInputSchema = studentSubmissionIdSchema.extend({
  grade: z.coerce
    .number({ error: "Enter a valid number." })
    .int("Grade must be a whole number.")
    .min(0, "Grade cannot be negative."),
  feedback: z
    .string()
    .max(5000, "Feedback must be at most 5000 characters.")
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
});
