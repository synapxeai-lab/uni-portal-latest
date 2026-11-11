import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTimeText } from "@/components/ui/date-time-text";
import { usePendingAction } from "@/hooks/use-pending-action";

import { cancelInvitationAction } from "../api";
import type { PendingInvitation } from "../types";

interface InvitationRowProps {
  classroomId: string;
  invitation: PendingInvitation;
  onCancelled: (invitationId: string) => void;
}

export function InvitationRow({ classroomId, invitation, onCancelled }: InvitationRowProps) {
  const router = useRouter();

  const cancel = usePendingAction(
    () => cancelInvitationAction(classroomId, invitation.id),
    () => {
      toast.success("Invitation cancelled");
      onCancelled(invitation.id);
      router.refresh();
    },
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{invitation.email}</span>
        <span className="truncate text-xs text-muted-foreground">
          Invited by {invitation.invitedByName} ·{" "}
          <DateTimeText value={invitation.createdAt} variant="date" />
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline">Pending</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancel.run}
          disabled={cancel.isPending}
        >
          {cancel.isPending ? "Cancelling…" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
