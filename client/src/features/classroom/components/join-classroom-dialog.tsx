import { useActionState, useEffect } from "react";
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

import { joinClassroomAction } from "../api";
import type { ActionResult, ClassroomSummary } from "../types";

const initialState: ActionResult<ClassroomSummary> | null = null;

interface JoinClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCode?: string;
}

export function JoinClassroomDialog({ open, onOpenChange, defaultCode }: JoinClassroomDialogProps) {
  // On success the action redirects into the class itself, so state only ever
  // carries errors here.
  const [state, formAction, isPending] = useActionState(joinClassroomAction, initialState);

  useEffect(() => {
    if (state?.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Join a class</DialogTitle>
            <DialogDescription>
              Ask your teacher for the class code, then enter it here.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="code">Class code</Label>
            <Input
              id="code"
              name="code"
              placeholder="e.g. h3k9pqz"
              defaultValue={defaultCode}
              required
              autoFocus
              className="mt-1.5 font-mono"
            />
            {fieldErrors?.code ? (
              <p className="mt-1.5 text-xs text-destructive">{fieldErrors.code[0]}</p>
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
              {isPending ? "Joining…" : "Join"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
