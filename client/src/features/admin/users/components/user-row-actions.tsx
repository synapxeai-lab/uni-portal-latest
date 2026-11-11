import { useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import {
  Archive,
  Ban,
  Eye,
  KeyRound,
  LockKeyhole,
  MoreVertical,
  Pencil,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserStatus } from "@portal/shared/enums";

import { forcePasswordChangeAction, resetPasswordAction, viewPasswordAction } from "../api";
import { EditUserDialog } from "./edit-user-dialog";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";
import { UserDetailsSheet } from "./user-details-sheet";
import type { AdminUserSummary } from "../types";

type ConfirmAction =
  | {
      type: "status";
      status: UserStatus;
      title: string;
      description: string;
      confirmLabel: string;
      destructive?: boolean;
    }
  | { type: "forcePasswordChange" };

interface UserRowActionsProps {
  user: AdminUserSummary;
  isSelf: boolean;
  onStatusChange: (userId: string, status: AdminUserSummary["status"], toastLabel: string) => void;
  onUpdated: (user: AdminUserSummary) => void;
}

export function UserRowActions({ user, isSelf, onStatusChange, onUpdated }: UserRowActionsProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isPending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);

  const isArchived = user.status === UserStatus.ARCHIVED;

  function handleResetPassword() {
    startTransition(async () => {
      const result = await resetPasswordAction(user.id);
      if (result.status === "success") {
        setTemporaryPassword(result.data.temporaryPassword);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleViewPassword() {
    startTransition(async () => {
      try {
        const { password } = await viewPasswordAction(user.id);
        if (password) {
          setCurrentPassword(password);
        } else {
          toast.error("This password was set before passwords became viewable. Reset it to get a viewable one.");
        }
      } catch {
        toast.error("Couldn't load this user's password. Please try again.");
      }
    });
  }

  function handleConfirm() {
    if (!confirmAction) {
      return;
    }

    if (confirmAction.type === "status") {
      onStatusChange(
        user.id,
        confirmAction.status,
        `${user.name} marked as ${confirmAction.confirmLabel.toLowerCase()}d`,
      );
      setConfirmAction(null);
      return;
    }

    startTransition(async () => {
      const result = await forcePasswordChangeAction(user.id);
      if (result.status === "success") {
        toast.success(`${user.name} must set a new password on next sign-in.`);
      } else {
        toast.error(result.message);
      }
      setConfirmAction(null);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Actions for ${user.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)} disabled={isSelf}>
            <Pencil /> Edit user
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleViewPassword} disabled={!user.hasViewablePassword}>
            <LockKeyhole /> View password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleResetPassword} disabled={isSelf || isArchived}>
            <KeyRound /> Reset password
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setConfirmAction({ type: "forcePasswordChange" })}
            disabled={isSelf || user.status !== UserStatus.ACTIVE}
          >
            <ShieldAlert /> Force password change
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status === UserStatus.ACTIVE ? (
            <DropdownMenuItem
              onSelect={() =>
                setConfirmAction({
                  type: "status",
                  status: UserStatus.INACTIVE,
                  title: `Deactivate ${user.name}?`,
                  description: "They will no longer be able to sign in until reactivated.",
                  confirmLabel: "Deactivate",
                })
              }
              disabled={isSelf}
            >
              <Ban /> Deactivate
            </DropdownMenuItem>
          ) : null}
          {user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED ? (
            <DropdownMenuItem
              onSelect={() =>
                setConfirmAction({
                  type: "status",
                  status: UserStatus.ACTIVE,
                  title: `Reactivate ${user.name}?`,
                  description: "They will be able to sign in again immediately.",
                  confirmLabel: "Reactivate",
                })
              }
              disabled={isSelf}
            >
              <RotateCcw /> Reactivate
            </DropdownMenuItem>
          ) : null}
          {user.status === UserStatus.ACTIVE ? (
            <DropdownMenuItem
              onSelect={() =>
                setConfirmAction({
                  type: "status",
                  status: UserStatus.SUSPENDED,
                  title: `Suspend ${user.name}?`,
                  description:
                    "They will be immediately blocked from signing in until reactivated.",
                  confirmLabel: "Suspend",
                  destructive: true,
                })
              }
              className="text-destructive focus:text-destructive"
              disabled={isSelf}
            >
              <ShieldAlert /> Suspend
            </DropdownMenuItem>
          ) : null}
          {!isArchived ? (
            <DropdownMenuItem
              onSelect={() =>
                setConfirmAction({
                  type: "status",
                  status: UserStatus.ARCHIVED,
                  title: `Archive ${user.name}?`,
                  description:
                    "This soft-deletes the account. They lose access immediately, and the account can be restored later.",
                  confirmLabel: "Archive",
                  destructive: true,
                })
              }
              className="text-destructive focus:text-destructive"
              disabled={isSelf}
            >
              <Archive /> Archive (soft delete)
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                setConfirmAction({
                  type: "status",
                  status: UserStatus.ACTIVE,
                  title: `Restore ${user.name}?`,
                  description: "This reactivates the archived account.",
                  confirmLabel: "Restore",
                })
              }
              disabled={isSelf}
            >
              <RotateCcw /> Restore
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDetailsSheet user={user} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <EditUserDialog
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onUpdated}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
        title={confirmAction?.type === "status" ? confirmAction.title : "Force password change?"}
        description={
          confirmAction?.type === "status"
            ? confirmAction.description
            : `${user.name} will be required to set a new password the next time they sign in.`
        }
        confirmLabel={
          confirmAction?.type === "status" ? confirmAction.confirmLabel : "Force change"
        }
        destructive={confirmAction?.type === "status" ? confirmAction.destructive : false}
        pending={isPending}
        onConfirm={handleConfirm}
      />

      {currentPassword ? (
        <TemporaryPasswordDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCurrentPassword(null);
            }
          }}
          userName={user.name}
          temporaryPassword={currentPassword}
          variant="current"
        />
      ) : null}

      {temporaryPassword ? (
        <TemporaryPasswordDialog
          open={temporaryPassword !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTemporaryPassword(null);
            }
          }}
          userName={user.name}
          temporaryPassword={temporaryPassword}
        />
      ) : null}
    </>
  );
}
