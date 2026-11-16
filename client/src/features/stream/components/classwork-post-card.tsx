import { ClipboardList, FileText, ImageIcon, Link2, Paperclip, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import Link from "@/components/ui/link";

import type { StreamClassworkItem } from "../types";
import { NewStreamItemBadge } from "./stream-freshness";

const MATERIAL_ICON: Record<string, LucideIcon> = {
  DOCUMENT: FileText,
  LINK: Link2,
  VIDEO: Video,
  IMAGE: ImageIcon,
  OTHER: Paperclip,
};

/** Where a classwork post leads: the assignment's own page, or the material on the Classwork tab. */
export function classworkPostHref(classroomId: string, item: StreamClassworkItem) {
  return item.kind === "ASSIGNMENT"
    ? `/classes/${classroomId}/classwork/${item.id}`
    : `/classes/${classroomId}/classwork#material-${item.id}`;
}

/**
 * A compact stream post for published classwork ("Mr. Bilal posted a new
 * assignment: Lab Report 1"). The whole card opens the item; comments and
 * submissions live on the item itself, not in the stream.
 */
export function ClassworkPostCard({ item, classroomId }: { item: StreamClassworkItem; classroomId: string }) {
  const isAssignment = item.kind === "ASSIGNMENT";
  const Icon = isAssignment ? ClipboardList : (MATERIAL_ICON[item.materialType ?? ""] ?? Paperclip);

  return (
    <Card id={`classwork-post-${item.id}`} className="scroll-mt-24 transition-colors hover:bg-muted/40">
      <Link href={classworkPostHref(classroomId, item)} className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm text-foreground">
            <span className="font-semibold">{item.author.name}</span> posted a new {isAssignment ? "assignment" : "material"}:{" "}
            <span className="font-semibold">{item.title}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            <DateTimeText value={item.postedAt} variant="relative" />
            {item.dueDate ? (
              <>
                {" · "}
                <DateTimeText value={item.dueDate} variant="due" />
              </>
            ) : null}
            {item.points !== null ? ` · ${item.points} points` : null}
          </span>
        </span>
        <NewStreamItemBadge itemId={item.id} authorId={item.author.id} />
      </Link>
    </Card>
  );
}
