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

import { transferOwnershipAction } from "../api";
import type { ActionResult, AdminClassroomSummary } from "../types";

const initialState: ActionResult<AdminClassroomSummary> | null = null;

interface TransferOwnershipDialogProps {
  classroom: AdminClassroomSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
}

export function TransferOwnershipDialog({
  classroom,
  open,
  onOpenChange,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [state, formAction, isPending] = useActionState(transferOwnershipAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(`Ownership of ${state.data.title} transferred`);
      onOpenChange(false);
      formRef.current?.reset();
      onTransferred();
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
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Currently owned by {classroom.ownerName}. The new owner must already have an account.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroom.id} />

          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="newOwnerEmail">New owner&apos;s email</Label>
            <Input
              id="newOwnerEmail"
              name="newOwnerEmail"
              type="email"
              required
              autoFocus
              placeholder="teacher@eithm.edu.pk"
            />
            {fieldErrors?.newOwnerEmail ? (
              <p className="text-xs text-destructive">{fieldErrors.newOwnerEmail[0]}</p>
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
              {isPending ? "Transferring…" : "Transfer ownership"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
