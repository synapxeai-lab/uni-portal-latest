import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { getClassroomDetailAction } from "../api";
import { statusBadgeVariant, statusLabels } from "../lib/classroom-display";
import type { AdminClassroomDetail, AdminClassroomSummary } from "../types";

interface ClassroomDetailsSheetProps {
  classroom: AdminClassroomSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  TEACHER: "Teacher",
  CO_TEACHER: "Co-teacher",
  STUDENT: "Student",
  ASSISTANT: "Assistant",
};

export function ClassroomDetailsSheet({
  classroom,
  open,
  onOpenChange,
}: ClassroomDetailsSheetProps) {
  const [detail, setDetail] = useState<AdminClassroomDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    startTransition(async () => {
      setDetail(null);
      const result = await getClassroomDetailAction(classroom.id);
      setDetail(result);
    });
  }, [open, classroom.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{classroom.title}</SheetTitle>
          <SheetDescription>
            {classroom.code} · Owned by {classroom.ownerName}
          </SheetDescription>
        </SheetHeader>

        <Badge variant={statusBadgeVariant[classroom.status]} className="w-fit">
          {statusLabels[classroom.status]}
        </Badge>

        <Separator />

        {isPending || !detail ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Statistics
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <StatRow label="Teachers" value={detail.statistics.teacherCount} />
                <StatRow label="Students" value={detail.statistics.studentCount} />
                <StatRow label="Topics" value={detail.statistics.topicCount} />
                <StatRow label="Announcements" value={detail.statistics.announcementCount} />
                <StatRow label="Materials" value={detail.statistics.materialCount} />
                <StatRow label="Assignments" value={detail.statistics.assignmentCount} />
                <StatRow label="Submissions" value={detail.statistics.submissionCount} />
                <StatRow label="Created" value={dateFormatter.format(detail.createdAt)} />
              </dl>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Enrolled users ({detail.members.length})
              </p>
              {detail.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active members.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{member.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {roleLabels[member.role] ?? member.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
