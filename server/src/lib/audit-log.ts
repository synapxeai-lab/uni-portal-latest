import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ActivityAction } from "@/generated/prisma/enums";

export type AuditEntityType =
  "User" | "Classroom" | "Assignment" | "Announcement" | "Material" | "Comment" | "TimetableClash";

interface AdminAuditEventDefinition {
  entityType: AuditEntityType;
  action: ActivityAction;
  /** Exact event name as tracked by the Phase 13.6 spec - shown as the "Action" column. */
  label: string;
}

/**
 * The fixed set of (entityType, action) pairs that count as a tracked
 * "administrative event" for the admin audit log. ActivityLog also holds
 * general classroom-participant activity (joined, submitted, ...) which is
 * deliberately excluded here - this list is the single source of truth for
 * both writing audit events and rendering/filtering them.
 */
export const ADMIN_AUDIT_EVENTS: AdminAuditEventDefinition[] = [
  { entityType: "User", action: ActivityAction.CREATED, label: "User Created" },
  { entityType: "User", action: ActivityAction.UPDATED, label: "User Updated" },
  { entityType: "User", action: ActivityAction.PASSWORD_RESET, label: "Password Reset" },
  { entityType: "User", action: ActivityAction.ROLE_CHANGED, label: "Role Changed" },
  { entityType: "User", action: ActivityAction.SUSPENDED, label: "User Suspended" },
  { entityType: "Classroom", action: ActivityAction.ARCHIVED, label: "Classroom Archived" },

  // Content moderation (Phase 13.8) - Delete/Archive/Restore, tracked
  // identically whether triggered by a teacher managing their own classroom
  // or an admin.
  { entityType: "Assignment", action: ActivityAction.DELETED, label: "Assignment Deleted" },
  { entityType: "Assignment", action: ActivityAction.ARCHIVED, label: "Assignment Archived" },
  { entityType: "Assignment", action: ActivityAction.RESTORED, label: "Assignment Restored" },
  { entityType: "Announcement", action: ActivityAction.DELETED, label: "Announcement Deleted" },
  { entityType: "Announcement", action: ActivityAction.ARCHIVED, label: "Announcement Archived" },
  { entityType: "Announcement", action: ActivityAction.RESTORED, label: "Announcement Restored" },
  { entityType: "Material", action: ActivityAction.DELETED, label: "Material Deleted" },
  { entityType: "Material", action: ActivityAction.ARCHIVED, label: "Material Archived" },
  { entityType: "Material", action: ActivityAction.RESTORED, label: "Material Restored" },
  { entityType: "Comment", action: ActivityAction.DELETED, label: "Comment Deleted" },
  { entityType: "Comment", action: ActivityAction.ARCHIVED, label: "Comment Archived" },
  { entityType: "Comment", action: ActivityAction.RESTORED, label: "Comment Restored" },

  // Security (Phase 13.9)
  { entityType: "User", action: ActivityAction.LOCKED, label: "Account Locked" },
  { entityType: "User", action: ActivityAction.UNLOCKED, label: "Account Unlocked" },
  { entityType: "User", action: ActivityAction.SESSION_TERMINATED, label: "Session Terminated" },

  // Timetable clash handling
  {
    entityType: "TimetableClash",
    action: ActivityAction.UPDATED,
    label: "Timetable Clash Resolved",
  },
];

export function getAdminAuditEventLabel(
  entityType: string,
  action: ActivityAction,
): string | undefined {
  return ADMIN_AUDIT_EVENTS.find(
    (event) => event.entityType === entityType && event.action === action,
  )?.label;
}

interface RecordAuditEventInput {
  actorId: string;
  action: ActivityAction;
  entityType: AuditEntityType;
  entityId: string;
  /** Human-readable snapshot of the target, e.g. "Ali Raza (ali.raza@eithm.edu.pk)". */
  targetLabel: string;
  classroomId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      actorId: input.actorId,
      classroomId: input.classroomId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      targetLabel: input.targetLabel,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
