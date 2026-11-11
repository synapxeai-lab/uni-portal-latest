import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { PendingInvitation } from "../types";
import { InvitationDialog } from "./invitation-dialog";
import { InvitationRow } from "./invitation-row";

interface InvitationSectionProps {
  classroomId: string;
  classroomCode: string;
  initialInvitations: PendingInvitation[];
  canInvite?: boolean;
}

export function InvitationSection({
  classroomId,
  classroomCode,
  initialInvitations,
  canInvite = true,
}: InvitationSectionProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleInvited(invitation: PendingInvitation) {
    setInvitations((previous) => [invitation, ...previous]);
  }

  function handleCancelled(invitationId: string) {
    setInvitations((previous) => previous.filter((invitation) => invitation.id !== invitationId));
  }

  return (
    <section aria-labelledby="invitations-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="invitations-heading" className="text-sm font-semibold text-foreground">
          Pending invitations
          <span className="ml-1.5 font-normal text-muted-foreground">{invitations.length}</span>
        </h2>
        {canInvite ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <UserPlus aria-hidden /> Invite
          </Button>
        ) : null}
      </div>

      <Card>
        {invitations.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                classroomId={classroomId}
                invitation={invitation}
                onCancelled={handleCancelled}
              />
            ))}
          </div>
        )}
      </Card>

      <InvitationDialog
        classroomId={classroomId}
        classroomCode={classroomCode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInvited={handleInvited}
      />
    </section>
  );
}
