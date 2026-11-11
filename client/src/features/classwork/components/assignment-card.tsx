import Link from "@/components/ui/link";
import { Award, CalendarClock, ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { AttachmentList } from "@/components/files/attachment-list";
import { ContentStatusBadge } from "@/features/scheduling/components/content-status-badge";

import type { AssignmentSummary, TopicSummary } from "../types";
import { AssignmentManagementMenu } from "./assignment-management-menu";

interface AssignmentCardProps {
  assignment: AssignmentSummary;
  classroomId: string;
  topics: TopicSummary[];
}

export function AssignmentCard({ assignment, classroomId, topics }: AssignmentCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-soft">
          <ClipboardList className="h-4 w-4 text-navy dark:text-gold" aria-hidden />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/classes/${classroomId}/classwork/${assignment.id}`}
              className="link-pill -mx-3 -my-1.5 block truncate text-sm font-medium text-foreground"
            >
              {assignment.title}
            </Link>
            <ContentStatusBadge status={assignment.status} scheduledFor={assignment.scheduledFor} />
          </div>

          {assignment.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{assignment.description}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {assignment.dueDate ? (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <CalendarClock className="h-3 w-3" aria-hidden />
                <DateTimeText value={assignment.dueDate} variant="due" />
              </span>
            ) : null}
            {assignment.points !== null ? (
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3" aria-hidden />
                {assignment.points} points
              </span>
            ) : null}
          </div>

          <AttachmentList
            attachments={assignment.attachments}
            className="mt-1 flex flex-col gap-1.5"
          />

          <p className="text-xs text-muted-foreground">{assignment.authorName}</p>
        </div>

        {assignment.canManage ? (
          <AssignmentManagementMenu
            classroomId={classroomId}
            assignment={assignment}
            topics={topics}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
