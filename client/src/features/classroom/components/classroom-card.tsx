import { Archive } from "lucide-react";
import Link from "@/components/ui/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { canManageClassroom } from "../lib/can-manage";
import type { ClassroomSummary } from "../types";
import { ClassroomCover } from "./classroom-cover";
import { ClassroomQuickActionsMenu } from "./classroom-quick-actions-menu";

export function ClassroomCard({ classroom }: { classroom: ClassroomSummary }) {
  const canManage = canManageClassroom(classroom.role);
  // /classes deliberately lists active and archived classrooms together (see
  // listUserClassrooms) - without this badge the two were visually
  // indistinguishable in the grid, unlike the classroom detail page's header,
  // which already marks archived state this same way.
  const isArchived = classroom.status === "ARCHIVED";

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative">
        <ClassroomCover
          classroomId={classroom.id}
          title={classroom.title}
          section={classroom.section}
          hasCoverImage={classroom.hasCoverImage}
          showTitle={false}
          className="h-24"
        />
        {isArchived ? (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 gap-1 border-white/30 bg-black/30 text-white"
          >
            <Archive className="h-3 w-3" aria-hidden /> Archived
          </Badge>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <Link
          href={`/classes/${classroom.id}/stream`}
          className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p className="truncate font-serif text-lg font-semibold text-primary dark:text-foreground">
            {classroom.title}
          </p>
          {classroom.section ? (
            <p className="truncate text-sm text-muted-foreground">{classroom.section}</p>
          ) : null}
        </Link>
        <ClassroomQuickActionsMenu classroom={classroom} canManage={canManage} />
      </div>
      <CardContent className="flex flex-1 flex-col justify-end gap-3 pt-2">
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="truncate text-sm text-muted-foreground">{classroom.ownerName}</p>
          <p className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            <span className="sr-only">Class code </span>
            {classroom.code}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
