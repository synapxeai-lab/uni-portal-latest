import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

import { setPasswordAction } from "../api";
import type { ActionResult, AdminUserSummary } from "../types";

interface ChangePasswordDialogProps {
  user: AdminUserSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

/** The admin types the user's new password; it works straight away. */
export function ChangePasswordDialog({ user, open, onOpenChange, onChanged }: ChangePasswordDialogProps) {
  const [state, formAction, isPending] = useActionState(setPasswordAction, null as ActionResult | null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) {
      return;
    }
    if (state.status === "success") {
      toast.success(`${user.name}'s password changed`);
      onOpenChange(false);
      onChanged();
    } else if (!state.fieldErrors?.password) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const passwordError = state?.status === "error" ? state.fieldErrors?.password?.[0] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Set a new password for {user.name}. They sign in with it right away; share it only with them.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="userId" value={user.id} />

          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                required
                maxLength={128}
                autoFocus
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide password" : "Show password"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {passwordError ? <p className="text-xs text-destructive">{passwordError}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
