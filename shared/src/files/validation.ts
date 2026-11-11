/** 25MB - generous for slide decks/PDFs/images, well under typical short-video sizes, while keeping the local dev disk (and any future body-size limit) bounded. */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

interface SupportedFileType {
  label: string;
  mimeTypes: string[];
  extensions: string[];
}

/**
 * One entry per supported category (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT,
 * ZIP, images, videos, per spec). Adding a new supported type is one entry
 * here - validation, icon selection (`@/components/files/icons`), and the
 * upload picker's `accept` attribute all derive from this single list.
 */
export const SUPPORTED_FILE_TYPES: SupportedFileType[] = [
  { label: "PDF", mimeTypes: ["application/pdf"], extensions: ["pdf"] },
  {
    label: "Word document",
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    extensions: ["doc", "docx"],
  },
  {
    label: "PowerPoint presentation",
    mimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    extensions: ["ppt", "pptx"],
  },
  {
    label: "Excel spreadsheet",
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    extensions: ["xls", "xlsx"],
  },
  { label: "Text file", mimeTypes: ["text/plain"], extensions: ["txt"] },
  {
    label: "ZIP archive",
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    extensions: ["zip"],
  },
  {
    label: "Image",
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "gif", "webp"],
  },
  {
    label: "Video",
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    extensions: ["mp4", "webm", "mov"],
  },
];

export const ALLOWED_MIME_TYPES = new Set(SUPPORTED_FILE_TYPES.flatMap((type) => type.mimeTypes));
const ALLOWED_EXTENSIONS = new Set(SUPPORTED_FILE_TYPES.flatMap((type) => type.extensions));

/** `accept` attribute value for a file `<input>` - every allowed extension and MIME type in one string. */
export const UPLOAD_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_MIME_TYPES,
  ...Array.from(ALLOWED_EXTENSIONS, (extension) => `.${extension}`),
].join(",");

/** 5MB - a classroom cover or an avatar is a single image, not a document/video, so it gets a tighter cap than general attachments. */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(
  SUPPORTED_FILE_TYPES.find((type) => type.label === "Image")!.mimeTypes,
);

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
}

export interface FileValidationError {
  fileName: string;
  message: string;
}

/**
 * Validates one file against the size cap and the type allow-list. Checks
 * both the browser-reported MIME type and the file extension (either
 * matching a known type is enough) - a client-reported MIME type is
 * trivially spoofable, so this is defense in depth alongside the extension
 * check, not a substitute for real magic-byte sniffing (a documented
 * follow-up, not implemented here - see the storage architecture summary).
 */
export function validateFile(file: {
  name: string;
  size: number;
  type: string;
}): FileValidationError | null {
  if (file.size === 0) {
    return { fileName: file.name, message: `"${file.name}" is empty and can't be uploaded.` };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return { fileName: file.name, message: `"${file.name}" is larger than the ${maxMb}MB limit.` };
  }

  const extension = getExtension(file.name);
  const mimeAllowed = file.type.length > 0 && ALLOWED_MIME_TYPES.has(file.type);
  const extensionAllowed = ALLOWED_EXTENSIONS.has(extension);

  if (!mimeAllowed && !extensionAllowed) {
    return { fileName: file.name, message: `"${file.name}" isn't a supported file type.` };
  }

  return null;
}

/**
 * Same shape as {@link validateFile} but restricted to the image subset - a
 * cover banner or avatar shouldn't accept a video or ZIP just because
 * that's allowed for lesson attachments. Shared by classroom cover images
 * and user avatars.
 */
export function validateImage(file: {
  name: string;
  size: number;
  type: string;
}): FileValidationError | null {
  if (file.size === 0) {
    return { fileName: file.name, message: `"${file.name}" is empty and can't be uploaded.` };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
    return { fileName: file.name, message: `"${file.name}" is larger than the ${maxMb}MB limit.` };
  }

  if (!IMAGE_MIME_TYPES.has(file.type)) {
    return {
      fileName: file.name,
      message: `"${file.name}" must be an image (JPEG, PNG, GIF, or WebP).`,
    };
  }

  return null;
}

/**
 * Validates a whole batch at once (everything one create/edit/submit
 * request sends together), additionally rejecting exact duplicates (same
 * name + size) within the batch - selecting the same file twice shouldn't
 * silently create two identical attachments.
 */
export function validateFileBatch(
  files: { name: string; size: number; type: string }[],
): FileValidationError[] {
  const errors: FileValidationError[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const error = validateFile(file);
    if (error) {
      errors.push(error);
      continue;
    }

    const dedupeKey = `${file.name}:${file.size}`;
    if (seen.has(dedupeKey)) {
      errors.push({ fileName: file.name, message: `"${file.name}" was selected more than once.` });
      continue;
    }
    seen.add(dedupeKey);
  }

  return errors;
}
