import { useMemo } from "react";

import { canManageClassroom } from "@/features/classroom/lib/can-manage";
import { useAnnouncements } from "@/features/stream/api";
import { AnnouncementComposer } from "@/features/stream/components/announcement-composer";
import { AnnouncementList } from "@/features/stream/components/announcement-list";
import { StreamFreshnessProvider } from "@/features/stream/components/stream-freshness";
import { StreamLiveUpdates } from "@/features/stream/components/stream-live-updates";
import { StreamSkeleton } from "@/features/stream/components/stream-skeleton";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

import { ClassroomNotFound, useCurrentClassroom } from "./classroom-layout";

export default function StreamPage() {
  const classroom = useCurrentClassroom();
  const user = useSession().data?.user;
  const announcements = useAnnouncements(classroom.id);

  const archived = classroom.status === "ARCHIVED";
  const canPost = canManageClassroom(classroom.role) && !archived;
  const currentUser = useMemo(
    () => ({ id: user?.id ?? "", name: user?.name ?? "You", image: user?.image ?? null }),
    [user?.id, user?.name, user?.image],
  );

  return (
    <div className="flex flex-col gap-4">
      <StreamLiveUpdates classroomId={classroom.id} />
      {canPost ? <AnnouncementComposer classroomId={classroom.id} /> : null}
      <QueryView
        query={announcements}
        loading={<StreamSkeleton />}
        notFound={<ClassroomNotFound />}
      >
        {(list) => {
          // Archived classrooms are read-only - per-item management menus and
          // the comment box are disabled by stripping canManage here. The
          // server independently enforces this too (assertClassroomActive).
          const visibleAnnouncements = archived
            ? list.map((announcement) => ({ ...announcement, canManage: false }))
            : list;
          return (
            <StreamFreshnessProvider
              initialIds={list.flatMap((announcement) => [
                announcement.id,
                ...announcement.comments.map((comment) => comment.id),
              ])}
              viewerId={currentUser.id}
            >
              <AnnouncementList
                announcements={visibleAnnouncements}
                classroomId={classroom.id}
                currentUser={currentUser}
                archived={archived}
              />
            </StreamFreshnessProvider>
          );
        }}
      </QueryView>
    </div>
  );
}
