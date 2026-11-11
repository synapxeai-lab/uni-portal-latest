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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploadField } from "@/components/files/attachment-upload-field";
import {
  PublishControls,
  type PublishMode,
} from "@/features/scheduling/components/publish-controls";

import { createMaterialAction, removeMaterialAttachmentAction, updateMaterialAction } from "../api";
import type { ActionResult, MaterialSummary, TopicSummary } from "../types";

const initialState: ActionResult<MaterialSummary> | null = null;

interface MaterialFormDialogProps {
  mode: "create" | "edit";
  classroomId: string;
  material?: MaterialSummary;
  topics: TopicSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaterialFormDialog({
  mode,
  classroomId,
  material,
  topics,
  open,
  onOpenChange,
}: MaterialFormDialogProps) {
  const router = useRouter();
  const action = mode === "create" ? createMaterialAction : updateMaterialAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("PUBLISHED");
  const [scheduledFor, setScheduledFor] = useState("");
  const [attachments, setAttachments] = useState(material?.attachments ?? []);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(mode === "create" ? "Material created" : "Material updated");
      onOpenChange(false);
      formRef.current?.reset();
      router.refresh();
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleRemoveAttachment(fileAttachmentId: string) {
    if (!material) {
      return;
    }
    setRemovingAttachmentId(fileAttachmentId);
    startRemoveTransition(async () => {
      const result = await removeMaterialAttachmentAction(
        classroomId,
        material.id,
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
            <DialogTitle>{mode === "create" ? "Add material" : "Edit material"}</DialogTitle>
            <DialogDescription>Share a document, link, or file with your class.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroomId} />
          {mode === "edit" && material ? (
            <input type="hidden" name="materialId" value={material.id} />
          ) : null}

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                name="title"
                defaultValue={material?.title}
                required
                maxLength={150}
                autoFocus
              />
              {fieldErrors?.title ? (
                <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="material-description">Description</Label>
              <Textarea
                id="material-description"
                name="description"
                defaultValue={material?.description ?? ""}
                rows={3}
                maxLength={2000}
              />
              {fieldErrors?.description ? (
                <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="material-url">Link URL</Label>
              <Input
                id="material-url"
                name="url"
                type="url"
                placeholder="https://…"
                defaultValue={material?.url ?? ""}
              />
              {fieldErrors?.url ? (
                <p className="text-xs text-destructive">{fieldErrors.url[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="material-topic">Topic</Label>
              <Select id="material-topic" name="topicId" defaultValue={material?.topicId ?? ""}>
                <option value="">No topic</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </Select>
              {fieldErrors?.topicId ? (
                <p className="text-xs text-destructive">{fieldErrors.topicId[0]}</p>
              ) : null}
            </div>

            <AttachmentUploadField
              id="material-files"
              existingAttachments={mode === "edit" ? attachments : undefined}
              onRemoveExisting={mode === "edit" ? handleRemoveAttachment : undefined}
              removingId={isRemoving ? removingAttachmentId : null}
              disabled={isPending}
            />

            {mode === "create" ? (
              <PublishControls
                mode={publishMode}
                onModeChange={setPublishMode}
                scheduledFor={scheduledFor}
                onScheduledForChange={setScheduledFor}
                fieldError={fieldErrors?.scheduledFor?.[0]}
                disabled={isPending}
                publishLabel="Post"
              />
            ) : null}
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
              {isPending
                ? "Saving…"
                : mode === "edit"
                  ? "Save"
                  : publishMode === "DRAFT"
                    ? "Save draft"
                    : publishMode === "SCHEDULED"
                      ? "Schedule"
                      : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
