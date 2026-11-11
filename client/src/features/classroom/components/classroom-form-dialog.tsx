import { startTransition, useActionState, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

import { createClassroomAction, updateClassroomAction } from "../api";
import type { ActionResult, ClassroomSummary } from "../types";

const initialState: ActionResult<ClassroomSummary> | null = null;

interface ClassroomFormDialogProps {
  mode: "create" | "edit";
  classroom?: ClassroomSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (classroom: ClassroomSummary) => void;
}

export function ClassroomFormDialog({
  mode,
  classroom,
  open,
  onOpenChange,
  onSaved,
}: ClassroomFormDialogProps) {
  const action = mode === "create" ? createClassroomAction : updateClassroomAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [removeCover, setRemoveCover] = useState(false);

  // Create redirects into the new class from the action itself, so a success
  // state only ever arrives here for edits.
  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(
        mode === "create" ? `${state.data.title} created` : `${state.data.title} updated`,
      );
      onOpenChange(false);
      formRef.current?.reset();
      startTransition(() => setRemoveCover(false));
      onSaved?.(state.data);
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form ref={formRef} action={formAction}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create class" : "Edit class"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Give your class a name and a section (required), plus a few optional details. You can change these later."
                : "Update your class details."}
            </DialogDescription>
          </DialogHeader>

          {mode === "edit" && classroom ? (
            <input type="hidden" name="classroomId" value={classroom.id} />
          ) : null}

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Class name</Label>
              <Input
                id="title"
                name="title"
                defaultValue={classroom?.title}
                required
                maxLength={100}
                autoFocus
              />
              {fieldErrors?.title ? (
                <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  name="section"
                  defaultValue={classroom?.section ?? ""}
                  required
                  maxLength={50}
                />
                {fieldErrors?.section ? (
                  <p className="text-xs text-destructive">{fieldErrors.section[0]}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  defaultValue={classroom?.subject ?? ""}
                  maxLength={100}
                />
                {fieldErrors?.subject ? (
                  <p className="text-xs text-destructive">{fieldErrors.subject[0]}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={classroom?.description ?? ""}
                maxLength={2000}
                rows={3}
              />
              {fieldErrors?.description ? (
                <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coverImage">Cover image</Label>
              {mode === "edit" && classroom?.hasCoverImage && !removeCover ? (
                <div className="flex items-center gap-3">
                  <img
                    src={`/api/classrooms/${classroom.id}/cover`}
                    alt="Current cover"
                    className="h-16 w-28 rounded-md border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRemoveCover(true)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
              <input
                id="coverImage"
                name="coverImage"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              <input type="hidden" name="removeCoverImage" value={removeCover ? "true" : "false"} />
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, GIF, or WebP - up to 5MB. Optional - a colored banner is used if you skip
                this.
              </p>
            </div>
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
              {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
