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
import { Select } from "@/components/ui/select";

import { createUserAction } from "../api";
import { roleLabels, roleOptions } from "../lib/user-display";
import type { ActionResult, CreatedUserResult } from "../types";

const initialState: ActionResult<CreatedUserResult> | null = null;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: CreatedUserResult) => void;
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [state, formAction, isPending] = useActionState(createUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
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
      <DialogContent className="sm:max-w-md">
        <form ref={formRef} action={formAction}>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              A temporary password is generated automatically - the new user must set their own on
              first sign-in. For a student or teacher, use the Students or Teachers page instead: it
              creates the login together with their academic record (programme, batch, section),
              which registration, attendance, marks and fees need.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required maxLength={100} autoFocus />
              {fieldErrors?.name ? (
                <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required maxLength={255} />
              {fieldErrors?.email ? (
                <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="STUDENT" required>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </Select>
              {fieldErrors?.role ? (
                <p className="text-xs text-destructive">{fieldErrors.role[0]}</p>
              ) : null}
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
              {isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
