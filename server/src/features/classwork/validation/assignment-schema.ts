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

// The marksheet category graded work counts in (QUIZ, ASSIGNMENT, MID...).
// "" means none (off the marksheet); left out on an edit keeps it as it is.
const marksCategoryField = z
  .string()
  .max(40, "Pick a valid marks category.")
  .optional()
  .transform((value) => (value === undefined ? undefined : value.trim() || null));

// The item's share of the course percentage; empty shares what the category has left.
const marksWeightageField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    return trimmed === undefined || trimmed === "" ? null : Number(trimmed);
  })
  .refine((value) => value === null || (Number.isFinite(value) && value > 0 && value <= 100), {
    message: "Weightage must be more than 0 and at most 100.",
  });

/** Work going on the marksheet needs points, and only work on it can carry a weightage. */
function refineMarks(
  data: { points?: string; marksCategory?: string | null; marksWeightage: number | null },
  ctx: z.RefinementCtx,
) {
  if (data.marksCategory && !data.points) {
    ctx.addIssue({ code: "custom", path: ["points"], message: "Give the assignment points to put it on the marksheet." });
  }
  if (data.marksWeightage !== null && !data.marksCategory) {
    ctx.addIssue({ code: "custom", path: ["marksWeightage"], message: "Pick a marks category for the weightage to count in." });
  }
}

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
    marksCategory: marksCategoryField,
    marksWeightage: marksWeightageField,
    allowLateSubmission: allowLateSubmissionField,
    topicId: topicIdField,
    // Creation only allows Draft, Scheduled, or Published - Closed only
    // makes sense as a transition from an already-published assignment.
    status: createContentStatusField,
    scheduledFor: scheduledForField,
  })
  .superRefine(refineScheduledFor)
  .superRefine(refineMarks)
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

export const updateAssignmentSchema = z
  .object({
    classroomId: z.string().uuid("Invalid classroom id."),
    assignmentId: z.string().uuid("Invalid assignment id."),
    title: titleField,
    description: optionalTrimmed(5000, "Instructions"),
    dueDate: dueDateField,
    points: pointsField,
    marksCategory: marksCategoryField,
    marksWeightage: marksWeightageField,
    allowLateSubmission: allowLateSubmissionField,
    topicId: topicIdField,
  })
  .superRefine(refineMarks);

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const assignmentIdSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment id."),
});
