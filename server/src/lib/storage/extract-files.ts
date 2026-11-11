import type { Request } from "express";

/**
 * Real, non-empty uploaded files of one multipart field, as web `File`
 * objects - the same shape the services received from FormData under
 * Next.js, so upload validation and storage code is unchanged.
 */
export function extractUploadedFiles(req: Request, fieldName = "files"): File[] {
  const uploaded = Array.isArray(req.files) ? req.files : [];
  return uploaded
    .filter((file) => file.fieldname === fieldName && file.size > 0 && file.originalname !== "")
    .map(
      (file) =>
        // Multer decodes multipart filenames as latin1; browsers send UTF-8.
        new File([file.buffer], Buffer.from(file.originalname, "latin1").toString("utf8"), {
          type: file.mimetype,
        }),
    );
}
