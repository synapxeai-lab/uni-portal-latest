import { Router } from "express";
import { z } from "zod";

import { HttpError, notFound } from "@/http/errors";
import { ATTACHMENT_CACHE_CONTROL, sendStoredFile } from "@/http/stored-file";
import { parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { prisma } from "@/lib/prisma";
import { assertCanAccessFileAttachment } from "@/lib/storage/file-authorization";
import { isLegacyPlaceholder } from "@/lib/storage/file-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";

export const fileRouter = Router();

/**
 * The one authorized entry point for viewing/downloading any uploaded file.
 * `?download=1` forces a "Save As" download; the default is `inline`, so the
 * browser previews PDFs/images/videos natively and downloads anything else.
 */
fileRouter.get("/:fileAttachmentId", async (req, res) => {
  const { fileAttachmentId } = parseParams(
    z.object({ fileAttachmentId: z.string().uuid() }),
    req.params,
    "Invalid file.",
  );

  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: fileAttachmentId },
    include: { file: true },
  });
  if (!attachment) {
    throw notFound("File not found.");
  }

  try {
    await assertCanAccessFileAttachment(currentUser(req), attachment);
  } catch (error) {
    if (error instanceof ClassroomServiceError) {
      throw new HttpError(error.code === "FORBIDDEN" ? 403 : 404, error.message, error.code);
    }
    throw error;
  }

  const { file } = attachment;
  if (isLegacyPlaceholder(file.storagePath)) {
    throw notFound(
      "This file was uploaded before file storage was enabled and isn't available to open or download.",
    );
  }

  const forceDownload = req.query.download === "1";
  const safeFileName = file.fileName.replace(/"/g, "");
  const encodedFileName = encodeURIComponent(file.fileName);

  await sendStoredFile(req, res, {
    storageKey: file.storagePath,
    contentType: file.mimeType || "application/octet-stream",
    cacheControl: ATTACHMENT_CACHE_CONTROL,
    contentLength: file.size,
    contentDisposition: `${forceDownload ? "attachment" : "inline"}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
  });
});
