import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * "Clear all notifications?" - shared by the bell popup and the Notifications
 * page. Stays open (showing progress) until the server confirms, and closes on
 * success; on failure the mutation shows a toast and the dialog stays open.
 */
export function ClearAllNotificationsDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title="Clear all notifications?"
      description="This removes all your notifications, read and unread. It can't be undone."
      confirmLabel="Clear all"
      destructive
      pending={pending}
      onConfirm={async () => {
        setPending(true);
        const ok = await onConfirm();
        setPending(false);
        if (ok) onOpenChange(false);
      }}
    />
  );
}
