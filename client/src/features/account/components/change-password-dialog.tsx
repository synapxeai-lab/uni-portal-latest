import { useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ChangePasswordForm } from "./change-password-form";

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <KeyRound /> Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Update the password you use to sign in.</DialogDescription>
        </DialogHeader>
        {/* Unmounted on close, so reopening starts with a fresh form state. */}
        {open ? <ChangePasswordForm forced={false} onSuccess={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
