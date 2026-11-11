import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { Copy, LogOut, MoreVertical, Pencil, RotateCcw, ShieldOff } from "lucide-react";
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
import { usePendingAction } from "@/hooks/use-pending-action";
import { cn } from "@/lib/utils";

import { archiveClassroomAction, leaveClassroomAction, restoreClassroomAction } from "../api";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import type { ClassroomSummary } from "../types";
import { ClassroomFormDialog } from "./classroom-form-dialog";

interface ClassroomQuickActionsMenuProps {
  classroom: ClassroomSummary;
  canManage: boolean;
  /** Override trigger button styling, e.g. when placed over a colored banner. */
  triggerClassName?: string;
}

export function ClassroomQuickActionsMenu({
  classroom,
  canManage,
  triggerClassName,
}: ClassroomQuickActionsMenuProps) {
  const router = useRouter();
  const { copy } = useCopyToClipboard();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const isArchived = classroom.status === "ARCHIVED";

  const archive = usePendingAction(
    () => archiveClassroomAction(classroom.id),
    () => {
      toast.success(`${classroom.title} archived`);
      setArchiveOpen(false);
      router.refresh();
    },
  );

  const restore = usePendingAction(
    () => restoreClassroomAction(classroom.id),
    () => {
      toast.success(`${classroom.title} restored`);
      router.refresh();
    },
  );

  const leave = usePendingAction(
    () => leaveClassroomAction(classroom.id),
    () => {
      toast.success(`Left ${classroom.title}`);
      setLeaveOpen(false);
      router.refresh();
    },
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${classroom.title}`}
            className={cn("shrink-0", triggerClassName)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => copy(classroom.code, "Class code copied")}>
            <Copy /> Copy class code
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              {isArchived ? (
                <DropdownMenuItem onSelect={restore.run} disabled={restore.isPending}>
                  <RotateCcw /> Restore class
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    <Pencil /> Edit class
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setArchiveOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <ShieldOff /> Archive class
                  </DropdownMenuItem>
                </>
              )}
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setLeaveOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <LogOut /> Leave class
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage && !isArchived ? (
        <ClassroomFormDialog
          mode="edit"
          classroom={classroom}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this class?"
        description={`${classroom.title} will move to Archived classes. Students won't be able to post or submit work.`}
        confirmLabel="Archive"
        destructive
        pending={archive.isPending}
        onConfirm={archive.run}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this class?"
        description={`You'll need the class code to rejoin ${classroom.title} later.`}
        confirmLabel="Leave"
        destructive
        pending={leave.isPending}
        onConfirm={leave.run}
      />
    </>
  );
}
