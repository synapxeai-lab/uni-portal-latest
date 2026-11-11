import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { canManageClassroom } from "../lib/can-manage";
import type { ClassroomSummary } from "../types";
import { ClassroomCover } from "./classroom-cover";
import { ClassroomQuickActionsMenu } from "./classroom-quick-actions-menu";
import { RestoreClassroomButton } from "./restore-classroom-button";

export function ClassroomHeader({ classroom }: { classroom: ClassroomSummary }) {
  const canManage = canManageClassroom(classroom.role);
  const isArchived = classroom.status === "ARCHIVED";

  return (
    <div className="flex flex-col">
      <div className="relative">
        <ClassroomCover
          classroomId={classroom.id}
          title={classroom.title}
          section={classroom.section}
          hasCoverImage={classroom.hasCoverImage}
          className="h-40 rounded-none sm:h-48 [&>p:first-of-type]:text-2xl sm:[&>p:first-of-type]:text-3xl"
        />
        {isArchived ? (
          <Badge
            variant="secondary"
            className="absolute left-4 top-4 gap-1 border-white/30 bg-black/30 text-white"
          >
            <Archive className="h-3 w-3" aria-hidden /> Archived
          </Badge>
        ) : null}
        <div className="absolute right-4 top-4">
          <ClassroomQuickActionsMenu
            classroom={classroom}
            canManage={canManage}
            triggerClassName="text-white hover:bg-white/15 hover:text-white"
          />
        </div>
      </div>

      {isArchived ? (
        <div className="flex flex-col items-start justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            This class is archived and is now read-only.
            {canManage
              ? " Restore it to post, create classwork, or invite members again."
              : " You can still view its content, but new activity is turned off."}
          </p>
          {canManage ? <RestoreClassroomButton classroomId={classroom.id} /> : null}
        </div>
      ) : null}
    </div>
  );
}
