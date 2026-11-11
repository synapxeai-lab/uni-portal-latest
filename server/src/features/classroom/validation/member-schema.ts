import { z } from "zod";

export const removeMemberSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  userId: z.string().uuid("Invalid user id."),
});

// Only the roles this phase ever assigns as a *target* role via the UI - TEACHER
// is never a selectable destination, it only ever appears as the automatic
// side effect of an ownership transfer.
export const changeMemberRoleSchema = z.object({
  classroomId: z.string().uuid("Invalid classroom id."),
  userId: z.string().uuid("Invalid user id."),
  role: z.enum(["CO_TEACHER", "STUDENT", "OWNER"]),
});
