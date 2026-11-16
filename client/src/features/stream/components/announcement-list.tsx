import type { AnnouncementSummary, StreamClassworkItem } from "../types";
import { AnnouncementCard } from "./announcement-card";
import { ClassworkPostCard } from "./classwork-post-card";
import { StreamEmptyState } from "./stream-empty-state";

interface AnnouncementListProps {
  announcements: AnnouncementSummary[];
  /** Published assignments and materials, merged into the feed by date. */
  classwork?: StreamClassworkItem[];
  classroomId: string;
  currentUser: { id: string; name: string; image: string | null };
  archived?: boolean;
}

type StreamEntry =
  | { kind: "announcement"; at: number; announcement: AnnouncementSummary }
  | { kind: "classwork"; at: number; item: StreamClassworkItem };

const time = (value: Date | string) => new Date(value).getTime();

/** Pinned announcements stay on top; everything else (announcements and classwork) is newest first. */
function streamEntries(announcements: AnnouncementSummary[], classwork: StreamClassworkItem[]): StreamEntry[] {
  const pinned = announcements.filter((a) => a.isPinned);
  const rest: StreamEntry[] = [
    ...announcements
      .filter((a) => !a.isPinned)
      .map((announcement) => ({ kind: "announcement" as const, at: time(announcement.createdAt), announcement })),
    ...classwork.map((item) => ({ kind: "classwork" as const, at: time(item.postedAt), item })),
  ].sort((a, b) => b.at - a.at);
  return [
    ...pinned.map((announcement) => ({ kind: "announcement" as const, at: time(announcement.createdAt), announcement })),
    ...rest,
  ];
}

export function AnnouncementList({
  announcements,
  classwork = [],
  classroomId,
  currentUser,
  archived = false,
}: AnnouncementListProps) {
  if (announcements.length === 0 && classwork.length === 0) {
    return <StreamEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      {streamEntries(announcements, classwork).map((entry) =>
        entry.kind === "announcement" ? (
          <AnnouncementCard
            key={entry.announcement.id}
            announcement={entry.announcement}
            classroomId={classroomId}
            currentUser={currentUser}
            archived={archived}
          />
        ) : (
          <ClassworkPostCard key={entry.item.id} item={entry.item} classroomId={classroomId} />
        ),
      )}
    </div>
  );
}
