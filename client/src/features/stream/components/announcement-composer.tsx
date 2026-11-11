import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploadField } from "@/components/files/attachment-upload-field";
import {
  PublishControls,
  type PublishMode,
} from "@/features/scheduling/components/publish-controls";

import { createAnnouncementAction } from "../api";
import type { ActionResult, AnnouncementSummary } from "../types";

const initialState: ActionResult<AnnouncementSummary> | null = null;

export function AnnouncementComposer({ classroomId }: { classroomId: string }) {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("PUBLISHED");
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(
        publishMode === "DRAFT"
          ? "Saved as draft"
          : publishMode === "SCHEDULED"
            ? "Announcement scheduled"
            : "Announcement posted",
      );
      formRef.current?.reset();
      // Resets the composer's PublishControls state after a successful post -
      // native form.reset() doesn't reach these React-controlled fields.
      /* eslint-disable react-hooks/set-state-in-effect */
      setPublishMode("PUBLISHED");
      setScheduledFor("");
      /* eslint-enable react-hooks/set-state-in-effect */
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="classroomId" value={classroomId} />
          <Textarea
            name="content"
            placeholder="Share something with your class…"
            rows={3}
            required
            maxLength={5000}
          />
          {fieldErrors?.content ? (
            <p className="text-xs text-destructive">{fieldErrors.content[0]}</p>
          ) : null}

          <AttachmentUploadField id="announcement-files" disabled={isPending} />

          <PublishControls
            mode={publishMode}
            onModeChange={setPublishMode}
            scheduledFor={scheduledFor}
            onScheduledForChange={setScheduledFor}
            fieldError={fieldErrors?.scheduledFor?.[0]}
            disabled={isPending}
            publishLabel="Post"
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Posting…"
                : publishMode === "DRAFT"
                  ? "Save draft"
                  : publishMode === "SCHEDULED"
                    ? "Schedule"
                    : "Post"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
