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
import { Label } from "@/components/ui/label";

import { assignTeacherAction } from "../api";
import type { ActionResult, AdminClassroomMember, AdminClassroomSummary } from "../types";

const initialState: ActionResult<AdminClassroomMember> | null = null;

interface AssignTeacherDialogProps {
  classroom: AdminClassroomSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function AssignTeacherDialog({
  classroom,
  open,
  onOpenChange,
  onAssigned,
}: AssignTeacherDialogProps) {
  const [state, formAction, isPending] = useActionState(assignTeacherAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(`${state.data.name} assigned as a teacher of ${classroom.title}`);
      onOpenChange(false);
      formRef.current?.reset();
      onAssigned();
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
            <DialogTitle>Assign teacher</DialogTitle>
            <DialogDescription>
              Adds this user as a teacher of {classroom.title}. They must already have an account.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroom.id} />

          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="teacherEmail">Teacher&apos;s email</Label>
            <Input
              id="teacherEmail"
              name="teacherEmail"
              type="email"
              required
              autoFocus
              placeholder="teacher@eithm.edu.pk"
            />
            {fieldErrors?.teacherEmail ? (
              <p className="text-xs text-destructive">{fieldErrors.teacherEmail[0]}</p>
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
              {isPending ? "Assigning…" : "Assign teacher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
