import { z } from "zod";

import { NotificationType } from "@/generated/prisma/enums";

export const listNotificationsSchema = z.object({
  cursor: z.string().uuid("Invalid cursor.").optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
  // Validated against the generated enum rather than a hand-listed set of
  // strings, so this can never drift out of sync with the schema (e.g. a new
  // NotificationType added later and forgotten here).
  type: z.nativeEnum(NotificationType).optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const notificationIdSchema = z.object({
  notificationId: z.string().uuid("Invalid notification id."),
});
