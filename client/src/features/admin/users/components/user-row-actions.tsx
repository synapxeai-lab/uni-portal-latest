import { useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import {
  Ban,
  Eye,
  KeyRound,
  LockKeyhole,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
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

import {
  deleteUserAction,
  viewPasswordAction,
} from "../api";
import { ChangePasswordDialog } from "./change-password-dialog";
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
  | { type: "delete" };

function deleteDescription(user: AdminUserSummary): string {
  const record = user.academicRecord
    ? ` Their ${user.role === "TEACHER" ? "teacher" : "student"} record is deleted too${
        user.role === "STUDENT" ? ", with their registrations" : ""
      }.`
    : "";
  const work =
    user.role === "STUDENT"
      ? " Their submissions, comments and posts are removed."
      : " Course classrooms they own, and the classwork they posted, pass to you; classrooms they made themselves are removed.";
  return `This permanently deletes ${user.name}'s account (${user.email}).${record}${work} This cannot be undone.`;
}

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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);

  const isArchived = user.status === UserStatus.ARCHIVED;

  function handleViewPassword() {
    startTransition(async () => {
      try {
        const { password } = await viewPasswordAction(user.id);
        if (password) {
          setCurrentPassword(password);
        } else {
          toast.error(
            "This password can't be shown: it was saved before passwords became viewable, or with another server's key. Change it to get a viewable one.",
          );
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
      const result = await deleteUserAction(user.id);
      if (result.status === "success") {
        toast.success(`${user.name} deleted.`);
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
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)} disabled={isSelf || isArchived}>
            <KeyRound /> Change password
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
          {isArchived ? (
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
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirmAction({ type: "delete" })}
            className="text-destructive focus:text-destructive"
            disabled={isSelf}
          >
            <Trash2 /> Delete user
          </DropdownMenuItem>
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
        title={confirmAction?.type === "status" ? confirmAction.title : `Delete ${user.name}?`}
        description={
          confirmAction?.type === "status" ? confirmAction.description : deleteDescription(user)
        }
        confirmLabel={confirmAction?.type === "status" ? confirmAction.confirmLabel : "Delete"}
        destructive={confirmAction?.type === "status" ? confirmAction.destructive : true}
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

      {passwordOpen ? (
        <ChangePasswordDialog
          user={user}
          open
          onOpenChange={setPasswordOpen}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
