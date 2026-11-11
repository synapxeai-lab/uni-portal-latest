import { useState, useTransition } from "react";
import { Archive, Eye, MoreVertical, RotateCcw, Trash2, UserCog, UserPlus } from "lucide-react";
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
import { ClassroomStatus } from "@portal/shared/enums";

import { archiveClassroomAction, deleteClassroomAction, restoreClassroomAction } from "../api";
import { AssignTeacherDialog } from "./assign-teacher-dialog";
import { ClassroomDetailsSheet } from "./classroom-details-sheet";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";
import type { AdminClassroomSummary } from "../types";

type ConfirmActionType = "archive" | "restore" | "delete";

interface ClassroomRowActionsProps {
  classroom: AdminClassroomSummary;
  /** Called after any successful mutation - the parent re-fetches via router.refresh(). */
  onChanged: () => void;
}

const confirmCopy: Record<
  ConfirmActionType,
  { title: (title: string) => string; description: string; confirmLabel: string }
> = {
  archive: {
    title: (title) => `Archive ${title}?`,
    description: "Members keep their history, but the classroom becomes read-only.",
    confirmLabel: "Archive",
  },
  restore: {
    title: (title) => `Restore ${title}?`,
    description: "This makes the classroom active again.",
    confirmLabel: "Restore",
  },
  delete: {
    title: (title) => `Delete ${title}?`,
    description:
      "This soft-deletes the classroom. Members lose access immediately, and it can be restored later.",
    confirmLabel: "Delete",
  },
};

export function ClassroomRowActions({ classroom, onChanged }: ClassroomRowActionsProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<ConfirmActionType | null>(null);
  const [isPending, startTransition] = useTransition();

  const isActive = classroom.status === ClassroomStatus.ACTIVE;
  const isDeleted = classroom.status === ClassroomStatus.DELETED;

  function handleConfirm() {
    if (!confirmType) {
      return;
    }

    startTransition(async () => {
      const action =
        confirmType === "archive"
          ? archiveClassroomAction
          : confirmType === "restore"
            ? restoreClassroomAction
            : deleteClassroomAction;

      const result = await action(classroom.id);

      if (result.status === "success") {
        toast.success(
          confirmType === "archive"
            ? `${classroom.title} archived`
            : confirmType === "restore"
              ? `${classroom.title} restored`
              : `${classroom.title} deleted`,
        );
      } else {
        toast.error(result.message);
      }

      setConfirmType(null);
      onChanged();
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
            aria-label={`Actions for ${classroom.title}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTransferOpen(true)} disabled={isDeleted}>
            <UserCog /> Transfer ownership
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAssignOpen(true)} disabled={isDeleted}>
            <UserPlus /> Assign teacher
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isActive ? (
            <DropdownMenuItem onSelect={() => setConfirmType("archive")}>
              <Archive /> Archive
            </DropdownMenuItem>
          ) : null}
          {!isActive ? (
            <DropdownMenuItem onSelect={() => setConfirmType("restore")}>
              <RotateCcw /> Restore
            </DropdownMenuItem>
          ) : null}
          {!isDeleted ? (
            <DropdownMenuItem
              onSelect={() => setConfirmType("delete")}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> Delete (soft delete)
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ClassroomDetailsSheet
        classroom={classroom}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <TransferOwnershipDialog
        classroom={classroom}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onTransferred={onChanged}
      />

      <AssignTeacherDialog
        classroom={classroom}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssigned={onChanged}
      />

      {confirmType ? (
        <ConfirmDialog
          open={confirmType !== null}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmType(null);
            }
          }}
          title={confirmCopy[confirmType].title(classroom.title)}
          description={confirmCopy[confirmType].description}
          confirmLabel={confirmCopy[confirmType].confirmLabel}
          destructive={confirmType === "delete"}
          pending={isPending}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}
