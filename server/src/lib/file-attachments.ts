import { prisma } from "@/lib/prisma";
import type { FileAttachmentType } from "@/generated/prisma/enums";

import { isLegacyPlaceholder } from "./storage/file-service";

export interface AttachedFileSummary {
  /** The FileAttachment id - what /api/files/[fileAttachmentId] keys on, not the underlying File id. */
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  /** False for a pre-storage record with no real bytes behind it - the UI hides Open/Download for these instead of linking to a 404. */
  isAvailable: boolean;
}

// FileAttachment is polymorphic (attachmentType + entityId), so it isn't a typed
// Prisma relation on Announcement/Material - fetched separately and grouped in memory.
export async function getFileAttachmentsByEntityIds(
  entityIds: string[],
  attachmentType: FileAttachmentType,
): Promise<Map<string, AttachedFileSummary[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const attachments = await prisma.fileAttachment.findMany({
    where: {
      attachmentType,
      entityId: { in: entityIds },
    },
    include: {
      file: {
        select: { fileName: true, mimeType: true, size: true, createdAt: true, storagePath: true },
      },
    },
  });

  const byEntityId = new Map<string, AttachedFileSummary[]>();

  for (const attachment of attachments) {
    const existing = byEntityId.get(attachment.entityId) ?? [];
    existing.push({
      id: attachment.id,
      fileName: attachment.file.fileName,
      mimeType: attachment.file.mimeType,
      size: attachment.file.size,
      uploadedAt: attachment.file.createdAt,
      isAvailable: !isLegacyPlaceholder(attachment.file.storagePath),
    });
    byEntityId.set(attachment.entityId, existing);
  }

  return byEntityId;
}
