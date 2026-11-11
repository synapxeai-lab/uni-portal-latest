import type { AnnouncementSummary } from "../types";
import { AnnouncementCard } from "./announcement-card";
import { StreamEmptyState } from "./stream-empty-state";

interface AnnouncementListProps {
  announcements: AnnouncementSummary[];
  classroomId: string;
  currentUser: { id: string; name: string; image: string | null };
  archived?: boolean;
}

export function AnnouncementList({
  announcements,
  classroomId,
  currentUser,
  archived = false,
}: AnnouncementListProps) {
  if (announcements.length === 0) {
    return <StreamEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          classroomId={classroomId}
          currentUser={currentUser}
          archived={archived}
        />
      ))}
    </div>
  );
}
