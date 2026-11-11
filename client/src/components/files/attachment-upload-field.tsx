import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UPLOAD_ACCEPT_ATTRIBUTE } from "@/lib/storage/validation";
import type { AttachedFileSummary } from "@/lib/file-attachments";

import { AttachmentRow } from "./attachment-row";

interface AttachmentUploadFieldProps {
  id: string;
  label?: string;
  /** Only passed when editing something that can already have attachments - omit entirely on a create form. */
  existingAttachments?: AttachedFileSummary[];
  onRemoveExisting?: (fileAttachmentId: string) => void;
  removingId?: string | null;
  disabled?: boolean;
}

/**
 * The file-picker + "existing attachments with a Remove button" pair shared
 * by every create/edit surface that accepts attachments (announcements,
 * materials, assignments) - new files ride along in the same form submit
 * under `name="files"` (extracted server-side by extractUploadedFiles),
 * while removing an existing one is its own immediate action, wired up by
 * the parent via `onRemoveExisting`.
 */
export function AttachmentUploadField({
  id,
  label = "Attachments",
  existingAttachments = [],
  onRemoveExisting,
  removingId,
  disabled,
}: AttachmentUploadFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>

      {existingAttachments.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {existingAttachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              trailing={
                onRemoveExisting ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={removingId === attachment.id}
                    onClick={() => onRemoveExisting(attachment.id)}
                    aria-label={`Remove ${attachment.fileName}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
      ) : null}

      <input
        id={id}
        name="files"
        type="file"
        multiple
        accept={UPLOAD_ACCEPT_ATTRIBUTE}
        disabled={disabled}
        className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />
      <p className="text-xs text-muted-foreground">
        PDF, Word, PowerPoint, Excel, text, ZIP, images, and videos - up to 25MB each.
      </p>
    </div>
  );
}
