import {
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Presentation,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FileIconCategory =
  "image" | "video" | "spreadsheet" | "presentation" | "archive" | "document" | "generic";

/** MIME type - not file extension - drives the icon, since that's what every attachment record actually stores. */
export function getFileIconCategory(mimeType: string): FileIconCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("spreadsheet") || mimeType === "application/vnd.ms-excel") {
    return "spreadsheet";
  }
  if (mimeType.includes("presentation") || mimeType === "application/vnd.ms-powerpoint") {
    return "presentation";
  }
  if (mimeType.includes("zip")) return "archive";
  if (mimeType === "application/pdf" || mimeType === "text/plain" || mimeType.includes("word")) {
    return "document";
  }
  return "generic";
}

// A plain lookup table, not a function call, so consumers select an icon via
// `FILE_ICON_BY_CATEGORY[category]` - the same object-index pattern already
// used by MaterialCard's TYPE_ICON, which keeps every icon reference stable
// across renders (a function call returning a component reference reads to
// static analysis as "might construct a new component each render").
export const FILE_ICON_BY_CATEGORY: Record<FileIconCategory, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FileArchive,
  document: FileText,
  generic: FileIcon,
};
