import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploadField } from "@/components/files/attachment-upload-field";

import { removeAnnouncementAttachmentAction, updateAnnouncementAction } from "../api";
import type { ActionResult, AnnouncementSummary } from "../types";

const initialState: ActionResult<AnnouncementSummary> | null = null;

interface AnnouncementEditDialogProps {
  classroomId: string;
  announcement: AnnouncementSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnnouncementEditDialog({
  classroomId,
  announcement,
  open,
  onOpenChange,
}: AnnouncementEditDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateAnnouncementAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [attachments, setAttachments] = useState(announcement.attachments);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success("Announcement updated");
      onOpenChange(false);
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleRemoveAttachment(fileAttachmentId: string) {
    setRemovingAttachmentId(fileAttachmentId);
    startRemoveTransition(async () => {
      const result = await removeAnnouncementAttachmentAction(
        classroomId,
        announcement.id,
        fileAttachmentId,
      );
      if (result.status === "success") {
        setAttachments((previous) => previous.filter((item) => item.id !== fileAttachmentId));
        toast.success("Attachment removed");
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setRemovingAttachmentId(null);
    });
  }

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form ref={formRef} action={formAction}>
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
            <DialogDescription>Update what you shared with your class.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroomId} />
          <input type="hidden" name="announcementId" value={announcement.id} />

          <div className="flex flex-col gap-4 py-4">
            <div>
              <Textarea
                name="content"
                defaultValue={announcement.content}
                rows={4}
                required
                maxLength={5000}
                autoFocus
              />
              {fieldErrors?.content ? (
                <p className="mt-1.5 text-xs text-destructive">{fieldErrors.content[0]}</p>
              ) : null}
            </div>

            <AttachmentUploadField
              id="announcement-edit-files"
              existingAttachments={attachments}
              onRemoveExisting={handleRemoveAttachment}
              removingId={isRemoving ? removingAttachmentId : null}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
