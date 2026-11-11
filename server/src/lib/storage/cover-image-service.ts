import { randomUUID } from "node:crypto";

import { getStorageProvider } from "./index";
import { sanitizeFileName } from "./file-service";
import { validateImage } from "./validation";

export class CoverImageValidationError extends Error {}

/**
 * Uploads a classroom's cover banner and returns the storage key to persist
 * on `Classroom.coverImageUrl`. Unlike lesson attachments, a cover image has
 * no `File`/`FileAttachment` row - it's a single, replaceable value owned
 * directly by the classroom, so the storage key alone is enough.
 */
export async function uploadClassroomCoverImage(file: File, classroomId: string): Promise<string> {
  const error = validateImage(file);
  if (error) {
    throw new CoverImageValidationError(error.message);
  }

  const key = `classroom-covers/${classroomId}-${randomUUID()}-${sanitizeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await getStorageProvider().upload(key, buffer);
  return key;
}

/** Best-effort - a missing/already-deleted key shouldn't block replacing or clearing the cover. */
export async function deleteClassroomCoverImage(key: string): Promise<void> {
  await getStorageProvider().delete(key);
}
