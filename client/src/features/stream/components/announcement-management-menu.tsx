import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import {
  CalendarClock,
  CalendarX,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Send,
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
import { ScheduleDialog } from "@/features/scheduling/components/schedule-dialog";
import { useContentScheduling } from "@/features/scheduling/hooks/use-content-scheduling";
import { usePendingAction } from "@/hooks/use-pending-action";

import { deleteAnnouncementAction, setAnnouncementPinnedAction } from "../api";
import type { AnnouncementSummary } from "../types";
import { AnnouncementEditDialog } from "./announcement-edit-dialog";

interface AnnouncementManagementMenuProps {
  classroomId: string;
  announcement: AnnouncementSummary;
}

export function AnnouncementManagementMenu({
  classroomId,
  announcement,
}: AnnouncementManagementMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scheduling = useContentScheduling("announcement", announcement.id);

  const pin = usePendingAction(
    () => setAnnouncementPinnedAction(classroomId, announcement.id, !announcement.isPinned),
    () => {
      toast.success(announcement.isPinned ? "Announcement unpinned" : "Announcement pinned");
      router.refresh();
    },
  );

  const remove = usePendingAction(
    () => deleteAnnouncementAction(classroomId, announcement.id),
    () => {
      toast.success("Announcement deleted");
      setDeleteOpen(false);
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
            aria-label="Announcement options"
            className="h-8 w-8 shrink-0"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {announcement.status === "PUBLISHED" ? (
            <DropdownMenuItem onSelect={pin.run} disabled={pin.isPending}>
              {announcement.isPinned ? <PinOff /> : <Pin />}
              {announcement.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
          ) : null}
          {announcement.status === "DRAFT" || announcement.status === "SCHEDULED" ? (
            <DropdownMenuItem
              onSelect={scheduling.publishImmediately}
              disabled={scheduling.isPending}
            >
              <Send /> Publish now
            </DropdownMenuItem>
          ) : null}
          {announcement.status === "DRAFT" ? (
            <DropdownMenuItem
              onSelect={scheduling.openScheduleDialog}
              disabled={scheduling.isPending}
            >
              <CalendarClock /> Schedule…
            </DropdownMenuItem>
          ) : null}
          {announcement.status === "SCHEDULED" ? (
            <DropdownMenuItem onSelect={scheduling.cancelSchedule} disabled={scheduling.isPending}>
              <CalendarX /> Cancel scheduled publication
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AnnouncementEditDialog
        classroomId={classroomId}
        announcement={announcement}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ScheduleDialog
        open={scheduling.scheduleDialogOpen}
        onOpenChange={scheduling.closeScheduleDialog}
        defaultValue={announcement.scheduledFor}
        pending={scheduling.isPending}
        onConfirm={scheduling.confirmSchedule}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this announcement?"
        description="This will remove the announcement and its comments from the stream. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={remove.run}
      />
    </>
  );
}
