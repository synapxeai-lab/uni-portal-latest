import { useActionState, useEffect, useRef } from "react";
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

import { createTopicAction } from "../api";
import type { ActionResult, TopicSummary } from "../types";

const initialState: ActionResult<TopicSummary> | null = null;

interface CreateTopicDialogProps {
  classroomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (topic: TopicSummary) => void;
}

export function CreateTopicDialog({
  classroomId,
  open,
  onOpenChange,
  onCreated,
}: CreateTopicDialogProps) {
  const [state, formAction, isPending] = useActionState(createTopicAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success("Topic created");
      onOpenChange(false);
      formRef.current?.reset();
      onCreated(state.data);
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form ref={formRef} action={formAction}>
          <DialogHeader>
            <DialogTitle>Create topic</DialogTitle>
            <DialogDescription>Group related classwork under a topic.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroomId} />

          <div className="py-4">
            <Input name="title" placeholder="e.g. Week 1" required maxLength={100} autoFocus />
            {fieldErrors?.title ? (
              <p className="mt-1.5 text-xs text-destructive">{fieldErrors.title[0]}</p>
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
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
