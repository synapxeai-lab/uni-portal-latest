import { z } from "zod";

import {
  createContentStatusField,
  refineScheduledFor,
  scheduledForField,
} from "@/lib/scheduling/schedule-validation";

export const createAnnouncementSchema = z
  .object({
    classroomId: z.string().uuid("Invalid classroom id."),
    content: z
      .string()
      .trim()
      .min(1, "Announcement can't be empty.")
      .max(5000, "Announcement must be at most 5000 characters."),
    status: createContentStatusField,
    scheduledFor: scheduledForField,
  })
  .superRefine(refineScheduledFor);

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  announcementId: z.string().uuid("Invalid announcement id."),
  content: z
    .string()
    .trim()
    .min(1, "Announcement can't be empty.")
    .max(5000, "Announcement must be at most 5000 characters."),
});

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const announcementIdSchema = z.object({
  announcementId: z.string().uuid("Invalid announcement id."),
});
