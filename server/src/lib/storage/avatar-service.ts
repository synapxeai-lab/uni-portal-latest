import { randomUUID } from "node:crypto";

import { getStorageProvider } from "./index";
import { sanitizeFileName } from "./file-service";
import { validateImage } from "./validation";

export class AvatarValidationError extends Error {}

/**
 * Uploads a user's profile photo and returns the storage key to persist on
 * `User.avatarStorageKey`. Like a classroom cover image, this is a single,
 * replaceable value with no `File`/`FileAttachment` row of its own.
 */
export async function uploadUserAvatar(file: File, userId: string): Promise<string> {
  const error = validateImage(file);
  if (error) {
    throw new AvatarValidationError(error.message);
  }

  const key = `avatars/${userId}-${randomUUID()}-${sanitizeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await getStorageProvider().upload(key, buffer);
  return key;
}

/** Best-effort - a missing/already-deleted key shouldn't block replacing the avatar. */
export async function deleteUserAvatar(key: string): Promise<void> {
  await getStorageProvider().delete(key);
}
