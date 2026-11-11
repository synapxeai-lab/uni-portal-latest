import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AttachedFileSummary } from "@/lib/file-attachments";

import { DateTimeText } from "@/components/ui/date-time-text";

import { formatFileSize } from "./format";
import { FILE_ICON_BY_CATEGORY, getFileIconCategory } from "./icons";

interface AttachmentRowProps {
  attachment: AttachedFileSummary;
  /** Extra actions rendered after Download (e.g. a remove button, only in editable contexts). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * One attachment, everywhere it's shown: assignment/material/announcement
 * cards, a submission's saved files, the To-do board. Clicking the filename
 * opens `/api/files/[id]` inline in a new tab - the browser previews it if
 * it can (PDF, image, video, ...) and falls back to downloading it
 * automatically if it can't, so no client-side "can this be previewed"
 * guessing is needed. The Download button next to it always forces a save,
 * matching the always-visible Download action Google Classroom shows.
 */
export function AttachmentRow({ attachment, trailing, className }: AttachmentRowProps) {
  const Icon = FILE_ICON_BY_CATEGORY[getFileIconCategory(attachment.mimeType)];
  const viewHref = `/api/files/${attachment.id}`;
  const downloadHref = `/api/files/${attachment.id}?download=1`;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </div>

      {attachment.isAvailable ? (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group/file link-pill -mx-3 -my-1.5 min-w-0 flex-1 flex-col items-start gap-0"
        >
          <span className="max-w-full truncate text-sm font-medium text-foreground group-hover/file:text-sidebar-accent-foreground">
            {attachment.fileName}
          </span>
          <span className="max-w-full truncate text-xs text-muted-foreground group-hover/file:text-sidebar-foreground">
            {formatFileSize(attachment.size)} ·{" "}
            <DateTimeText value={attachment.uploadedAt} variant="date" />
          </span>
        </a>
      ) : (
        <div
          className="flex min-w-0 flex-1 flex-col"
          title="Uploaded before file storage was enabled - not available to open or download."
        >
          <span className="truncate text-sm font-medium text-muted-foreground">
            {attachment.fileName}
          </span>
          <span className="truncate text-xs text-muted-foreground">Not available</span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {attachment.isAvailable ? (
          <a
            href={downloadHref}
            download={attachment.fileName}
            aria-label={`Download ${attachment.fileName}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
