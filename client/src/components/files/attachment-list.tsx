import type { AttachedFileSummary } from "@/lib/file-attachments";

import { AttachmentRow } from "./attachment-row";

interface AttachmentListProps {
  attachments: AttachedFileSummary[];
  className?: string;
}

/** Read-only list of attachments - the generic display used by assignment/material/announcement cards and the To-do board. For an editable list with per-item removal, see SubmissionAttachmentList, which composes AttachmentRow directly instead. */
export function AttachmentList({ attachments, className }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "flex flex-col gap-1.5"}>
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}
