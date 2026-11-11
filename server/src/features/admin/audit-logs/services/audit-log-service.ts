import { ADMIN_AUDIT_EVENTS, getAdminAuditEventLabel } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

import type { AuditLogEntry, AuditLogsPage, ListAuditLogParams } from "../types";

const DEFAULT_PAGE_SIZE = 20;

export async function listAuditLogs(params: ListAuditLogParams): Promise<AuditLogsPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const selectedEvent = params.eventLabel
    ? ADMIN_AUDIT_EVENTS.find((event) => event.label === params.eventLabel)
    : undefined;

  // Only the fixed set of tracked administrative events belongs on this page -
  // ActivityLog also holds general classroom-participant activity (joined,
  // submitted, ...) which is deliberately excluded here.
  const eventFilter: Prisma.ActivityLogWhereInput = selectedEvent
    ? { entityType: selectedEvent.entityType, action: selectedEvent.action }
    : {
        OR: ADMIN_AUDIT_EVENTS.map((event) => ({
          entityType: event.entityType,
          action: event.action,
        })),
      };

  const searchFilter: Prisma.ActivityLogWhereInput = params.search
    ? {
        OR: [
          { targetLabel: { contains: params.search, mode: "insensitive" } },
          { actor: { name: { contains: params.search, mode: "insensitive" } } },
          { actor: { email: { contains: params.search, mode: "insensitive" } } },
        ],
      }
    : {};

  const where: Prisma.ActivityLogWhereInput = { AND: [eventFilter, searchFilter] };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { name: true, email: true } },
        classroom: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const entries: AuditLogEntry[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    actorName: log.actor.name,
    actorEmail: log.actor.email,
    action: log.action,
    actionLabel: getAdminAuditEventLabel(log.entityType, log.action) ?? log.action,
    entityType: log.entityType,
    targetLabel: log.targetLabel ?? "—",
    classroomTitle: log.classroom?.title ?? null,
  }));

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
