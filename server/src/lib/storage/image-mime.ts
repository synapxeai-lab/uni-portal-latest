const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Cover images and avatars have no `File` row to read a stored MIME type
 * from (unlike lesson attachments) - derived from the storage key's own
 * file extension instead. Shared by cover-image-service.ts and
 * avatar-service.ts rather than each keeping its own copy of this map.
 */
export function getImageMimeType(key: string): string {
  const dotIndex = key.lastIndexOf(".");
  const extension = dotIndex === -1 ? "" : key.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MIME_TYPES[extension] ?? "application/octet-stream";
}
