import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { FileAttachmentType } from "@/generated/prisma/enums";

import { getStorageProvider } from "./index";
import { validateFileBatch, type FileValidationError } from "./validation";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

/** Marks a `File` row created before real storage existed (Phase pre-upload) - no bytes were ever written for these, so they can never be opened/downloaded. Preserved, not deleted, for backward compatibility - see the storage migration notes. */
export const LEGACY_STORAGE_PREFIX = "metadata-only/";

export function isLegacyPlaceholder(storagePath: string): boolean {
  return storagePath.startsWith(LEGACY_STORAGE_PREFIX);
}

export class FileValidationBatchError extends Error {
  constructor(public readonly errors: FileValidationError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "FileValidationBatchError";
  }
}

export function sanitizeFileName(fileName: string): string {
  const stripped = fileName.replace(/[/\\]/g, "_").replace(/^\.+/, "");
  return stripped.slice(-180) || "file";
}

function buildStorageKey(attachmentType: FileAttachmentType, fileName: string): string {
  return `${attachmentType.toLowerCase()}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

/**
 * The single place every feature (announcements, materials, assignments,
 * submissions) goes through to turn a batch of real browser `File` objects
 * into persisted bytes plus `File`/`FileAttachment` rows. Validates the
 * whole batch up front - a bad file anywhere in the batch fails the entire
 * call before anything is written to storage or the database, rather than
 * silently dropping just that one file.
 *
 * Accepts an optional `tx` so it composes with a caller's existing
 * `prisma.$transaction(...)` (every create-flow already wraps its own writes
 * in one) - the DB rows land in that same transaction, while the storage
 * write itself necessarily happens outside it (no external object store
 * participates in a Postgres transaction). If the surrounding transaction
 * later rolls back, the uploaded bytes are orphaned on disk rather than
 * referenced by a row - a known, accepted tradeoff for this scope; a
 * production system would reconcile this with a periodic cleanup sweep.
 */
export async function uploadAttachments(params: {
  files: File[];
  attachmentType: FileAttachmentType;
  entityId: string;
  uploadedById: string;
  tx?: PrismaClientOrTransaction;
}): Promise<void> {
  const { files, attachmentType, entityId, uploadedById } = params;

  if (files.length === 0) {
    return;
  }

  const errors = validateFileBatch(files);
  if (errors.length > 0) {
    throw new FileValidationBatchError(errors);
  }

  const db = params.tx ?? prisma;
  const provider = getStorageProvider();

  for (const file of files) {
    const key = buildStorageKey(attachmentType, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await provider.upload(key, buffer);

    const created = await db.file.create({
      data: {
        storagePath: key,
        storageProvider: "local",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: buffer.byteLength,
        uploadedById,
      },
    });

    await db.fileAttachment.create({
      data: {
        fileId: created.id,
        attachmentType,
        entityId,
      },
    });
  }
}

/**
 * Deletes one attachment - the `FileAttachment` row, and (once no other
 * attachment references the same `File` row) the `File` row and its stored
 * bytes too. Safe to call on a legacy metadata-only row: there's nothing on
 * disk to remove, so the storage call is skipped entirely.
 */
export async function deleteAttachment(fileAttachmentId: string): Promise<void> {
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: fileAttachmentId },
    include: { file: true },
  });

  if (!attachment) {
    return;
  }

  await prisma.fileAttachment.delete({ where: { id: fileAttachmentId } });

  const remainingReferences = await prisma.fileAttachment.count({
    where: { fileId: attachment.fileId },
  });

  if (remainingReferences === 0) {
    await prisma.file.delete({ where: { id: attachment.fileId } });
    if (!isLegacyPlaceholder(attachment.file.storagePath)) {
      await getStorageProvider().delete(attachment.file.storagePath);
    }
  }
}
