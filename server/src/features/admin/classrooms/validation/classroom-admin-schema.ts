import { z } from "zod";

export const transferOwnershipSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  newOwnerEmail: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export const assignTeacherSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  teacherEmail: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
