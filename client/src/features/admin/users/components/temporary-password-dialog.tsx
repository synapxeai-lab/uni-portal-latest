import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface TemporaryPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  temporaryPassword: string;
  /** "current" shows a user's existing password (View password) instead of a new temporary one. */
  variant?: "temporary" | "current";
}

export function TemporaryPasswordDialog({
  open,
  onOpenChange,
  userName,
  temporaryPassword,
  variant = "temporary",
}: TemporaryPasswordDialogProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{variant === "current" ? "Current password" : "Temporary password"}</DialogTitle>
          <DialogDescription>
            {variant === "current"
              ? `${userName}'s current password. Share it only with them.`
              : `Share this password with ${userName}. It won't be shown again, and they'll be required to set their own on first sign-in.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2.5 font-mono text-sm">
          <span className="select-all break-all">{temporaryPassword}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => copy(temporaryPassword, "Password copied")}
            aria-label="Copy password"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
