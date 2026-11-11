import { z } from "zod";

import { ROOM_FORMAT_MESSAGE, ROOM_PATTERN } from "../lib/slots";

const dayOfWeek = z.coerce
  .number()
  .int("Pick a day.")
  .min(1, "Classes run Monday to Saturday.")
  .max(6, "Classes run Monday to Saturday.");
const startHour = z.coerce.number().int("Pick a valid time slot.");
const room = z
  .string()
  .trim()
  .min(1, "Enter the room number.")
  .regex(ROOM_PATTERN, ROOM_FORMAT_MESSAGE);

export const scheduleSlotSchema = z.object({
  classroomId: z.string().uuid("Pick a class."),
  dayOfWeek,
  startHour,
  room,
});

export const rescheduleSlotSchema = z.object({
  slotId: z.string().uuid("Invalid slot."),
  dayOfWeek,
  startHour,
  room,
});

export const slotIdSchema = z.object({ slotId: z.string().uuid("Invalid slot.") });

export const availabilitySchema = z.object({
  classroomId: z.string().uuid("Pick a class."),
  dayOfWeek,
  /** When rescheduling, the slot being moved is ignored so it doesn't block itself. */
  excludeSlotId: z.string().uuid().optional(),
  /** Optional: when given, hours where this room is already in use are flagged. */
  room: z.string().trim().max(30).optional(),
});

export const resolveClashSchema = z.object({
  clashId: z.string().uuid("Invalid clash."),
  dayOfWeek,
  startHour,
  room,
});

export const clashAvailabilitySchema = z.object({
  clashId: z.string().uuid("Invalid clash."),
  dayOfWeek,
  room: z.string().trim().max(30).optional(),
});

export const dismissClashSchema = z.object({ clashId: z.string().uuid("Invalid clash.") });
