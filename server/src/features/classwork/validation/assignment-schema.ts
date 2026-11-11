import { z } from "zod";

import { isIsoInstant } from "@/lib/datetime/format";
import {
  createContentStatusField,
  refineScheduledFor,
  scheduledForField,
} from "@/lib/scheduling/schedule-validation";

import { optionalTrimmed, topicIdField } from "./shared";

const dueDateField = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  // The form converts the picked wall-clock time to an exact instant in the
  // teacher's own zone - a zone-less string would be read in the server's.
  .refine((value) => !value || isIsoInstant(value), {
    message: "Invalid due date.",
  });

const pointsField = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  })
  .refine((value) => !value || (/^\d+$/.test(value) && Number(value) <= 100_000), {
    message: "Points must be a whole number no greater than 100000.",
  });

// Checkbox inputs only post a value when checked, so absence means false.
const allowLateSubmissionField = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

const titleField = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(150, "Title must be at most 150 characters.");

export const createAssignmentSchema = z
  .object({
    classroomId: z.string().uuid("Invalid classroom id."),
    title: titleField,
    description: optionalTrimmed(5000, "Instructions"),
    dueDate: dueDateField,
    points: pointsField,
    allowLateSubmission: allowLateSubmissionField,
    topicId: topicIdField,
    // Creation only allows Draft, Scheduled, or Published - Closed only
    // makes sense as a transition from an already-published assignment.
    status: createContentStatusField,
    scheduledFor: scheduledForField,
  })
  .superRefine(refineScheduledFor)
  .superRefine((data, ctx) => {
    if (!data.dueDate) {
      return;
    }
    const due = Date.parse(data.dueDate);
    if (due <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be in the future.",
      });
    } else if (
      data.status === "SCHEDULED" &&
      data.scheduledFor &&
      due <= Date.parse(data.scheduledFor)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be after the scheduled publish time.",
      });
    }
  });

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  assignmentId: z.string().uuid("Invalid assignment id."),
  title: titleField,
  description: optionalTrimmed(5000, "Instructions"),
  dueDate: dueDateField,
  points: pointsField,
  allowLateSubmission: allowLateSubmissionField,
  topicId: topicIdField,
});

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const assignmentIdSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment id."),
});
