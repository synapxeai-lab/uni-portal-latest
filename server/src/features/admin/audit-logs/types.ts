import type { ActivityAction } from "@/generated/prisma/enums";

export interface AuditLogEntry {
  id: string;
  createdAt: Date;
  actorName: string;
  actorEmail: string;
  action: ActivityAction;
  actionLabel: string;
  entityType: string;
  targetLabel: string;
  classroomTitle: string | null;
}

export interface ListAuditLogParams {
  search?: string;
  /** One of ADMIN_AUDIT_EVENTS' labels, e.g. "User Suspended" - matched to its (entityType, action) pair. */
  eventLabel?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogsPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
