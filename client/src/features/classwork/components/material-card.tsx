import { ExternalLink, FileText, ImageIcon, Link2, Paperclip, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AttachmentList } from "@/components/files/attachment-list";
import { MaterialType } from "@portal/shared/enums";
import { ContentStatusBadge } from "@/features/scheduling/components/content-status-badge";

import type { MaterialSummary, TopicSummary } from "../types";
import { MaterialManagementMenu } from "./material-management-menu";

const TYPE_ICON: Record<MaterialType, LucideIcon> = {
  [MaterialType.DOCUMENT]: FileText,
  [MaterialType.LINK]: Link2,
  [MaterialType.VIDEO]: Video,
  [MaterialType.IMAGE]: ImageIcon,
  [MaterialType.OTHER]: Paperclip,
};

interface MaterialCardProps {
  material: MaterialSummary;
  classroomId: string;
  topics: TopicSummary[];
}

export function MaterialCard({ material, classroomId, topics }: MaterialCardProps) {
  const Icon = TYPE_ICON[material.type];

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-link dark:text-foreground" aria-hidden />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{material.title}</p>
            <ContentStatusBadge status={material.status} scheduledFor={material.scheduledFor} />
          </div>
          {material.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{material.description}</p>
          ) : null}
          {material.url ? (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-pill -mx-3 -my-1.5 min-w-0 text-xs text-primary"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="truncate">{material.url}</span>
            </a>
          ) : null}
          <AttachmentList
            attachments={material.attachments}
            className="mt-1 flex flex-col gap-1.5"
          />
          <p className="text-xs text-muted-foreground">{material.authorName}</p>
        </div>

        {material.canManage ? (
          <MaterialManagementMenu classroomId={classroomId} material={material} topics={topics} />
        ) : null}
      </CardContent>
    </Card>
  );
}
