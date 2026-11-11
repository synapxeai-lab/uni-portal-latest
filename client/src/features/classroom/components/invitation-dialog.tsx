import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
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

import { inviteMemberAction } from "../api";
import type { ActionResult, PendingInvitation } from "../types";

const initialState: ActionResult<PendingInvitation> | null = null;

interface InvitationDialogProps {
  classroomId: string;
  classroomCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (invitation: PendingInvitation) => void;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          className="font-mono text-sm"
          onFocus={(e) => e.target.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * There's no email-sending infrastructure in this app - an invite becomes
 * real by the invitee actually using the class code, not by a message
 * arriving in their inbox. So this dialog does two things after "Invite":
 * a registered invitee gets an in-app notification (see notifyInvited),
 * and the teacher always gets a copyable code/link to send however they
 * like (Slack, text, email client, etc.) themselves.
 */
export function InvitationDialog({
  classroomId,
  classroomCode,
  open,
  onOpenChange,
  onInvited,
}: InvitationDialogProps) {
  const [state, formAction, isPending] = useActionState(inviteMemberAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(`Invitation created for ${state.data.email}`);
      formRef.current?.reset();
      startTransition(() => setSentTo(state.data.email));
      onInvited(state.data);
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;
  const joinLink =
    typeof window !== "undefined" ? `${window.location.origin}/classes?code=${classroomCode}` : "";

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSentTo(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        {sentTo ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation created</DialogTitle>
              <DialogDescription>
                Share this class code or link with {sentTo} so they can join. If they already have
                an account, they&apos;ve also been notified in-app.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              <CopyField label="Class code" value={classroomCode} />
              <CopyField label="Join link" value={joinLink} />
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form ref={formRef} action={formAction}>
            <DialogHeader>
              <DialogTitle>Invite someone</DialogTitle>
              <DialogDescription>
                They&apos;ll appear here as pending. Registered users are notified in-app; for
                everyone else, you&apos;ll get a class code/link to share yourself.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="classroomId" value={classroomId} />

            <div className="flex flex-col gap-1.5 py-4">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                autoFocus
              />
              {fieldErrors?.email ? (
                <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Inviting…" : "Invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
