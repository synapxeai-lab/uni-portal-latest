import multer from "multer";

import { MAX_FILE_SIZE_BYTES } from "@portal/shared/files/validation";

/**
 * Multipart parsing for endpoints that accept files (in memory - each file
 * is validated and then written through the StorageProvider). Text fields
 * land on req.body, files on req.files.
 */
export const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 20, fields: 100 },
}).any();
