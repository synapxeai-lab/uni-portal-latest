import { z } from "zod";

const titleField = z
  .string()
  .trim()
  .min(1, "Topic name can't be empty.")
  .max(100, "Topic name must be at most 100 characters.");

export const createTopicSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  title: titleField,
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const renameTopicSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  topicId: z.string().uuid("Invalid topic id."),
  title: titleField,
});

export type RenameTopicInput = z.infer<typeof renameTopicSchema>;

export const topicIdSchema = z.object({
  topicId: z.string().uuid("Invalid topic id."),
});

export const reorderTopicsSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  orderedTopicIds: z.array(z.string().uuid("Invalid topic id.")).min(1, "Nothing to reorder."),
});

export type ReorderTopicsInput = z.infer<typeof reorderTopicsSchema>;
