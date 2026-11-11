import { Pin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { AttachmentList } from "@/components/files/attachment-list";
import { ContentStatusBadge } from "@/features/scheduling/components/content-status-badge";
import { cn, getInitials } from "@/lib/utils";

import type { AnnouncementSummary } from "../types";
import { AnnouncementManagementMenu } from "./announcement-management-menu";
import { CommentThread } from "./comment-thread";
import { NewStreamItemBadge } from "./stream-freshness";

interface AnnouncementCardProps {
  announcement: AnnouncementSummary;
  classroomId: string;
  currentUser: { id: string; name: string; image: string | null };
  archived?: boolean;
}

export function AnnouncementCard({
  announcement,
  classroomId,
  currentUser,
  archived = false,
}: AnnouncementCardProps) {
  return (
    // Pinned posts get a gold left rule plus the "Pinned" label - enough to
    // stand out in the feed without tinting the whole card.
    <Card
      id={`announcement-${announcement.id}`}
      className={cn("scroll-mt-24", announcement.isPinned && "border-l-4 border-l-gold")}
    >
      <CardHeader className="flex-row items-start gap-3 pb-3">
        <Avatar>
          {announcement.author.image ? (
            <AvatarImage src={announcement.author.image} alt={announcement.author.name} />
          ) : null}
          <AvatarFallback>{getInitials(announcement.author.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-semibold text-foreground">
            {announcement.author.name}
          </p>
          <p className="text-xs text-muted-foreground">
            <DateTimeText value={announcement.createdAt} variant="relative" />
            {announcement.isEdited ? " · edited" : ""}
          </p>
        </div>
        <NewStreamItemBadge itemId={announcement.id} authorId={announcement.author.id} />
        {announcement.isPinned ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-md bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-foreground dark:text-gold"
            title="Pinned announcement"
          >
            <Pin className="h-3.5 w-3.5" aria-hidden />
            Pinned
          </span>
        ) : null}
        <ContentStatusBadge status={announcement.status} scheduledFor={announcement.scheduledFor} />
        {announcement.canManage ? (
          <AnnouncementManagementMenu classroomId={classroomId} announcement={announcement} />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="whitespace-pre-wrap text-sm text-foreground">{announcement.content}</p>

        <AttachmentList attachments={announcement.attachments} />

        <CommentThread
          classroomId={classroomId}
          announcementId={announcement.id}
          comments={announcement.comments}
          currentUser={currentUser}
          archived={archived}
        />
      </CardContent>
    </Card>
  );
}
