import { Skeleton } from "@/components/ui/skeleton";
import { canManageClassroom } from "@/features/classroom/lib/can-manage";
import { useClasswork } from "@/features/classwork/api";
import { TopicList } from "@/features/classwork/components/topic-list";
import { QueryView } from "@/app/route-states";

import { ClassroomNotFound, useCurrentClassroom } from "./classroom-layout";

export function ClassworkLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ClassworkPage() {
  const classroom = useCurrentClassroom();
  const classwork = useClasswork(classroom.id);

  const archived = classroom.status === "ARCHIVED";
  // Archived classrooms are read-only - creating topics/materials/assignments
  // and editing existing ones is disabled here; the server independently
  // enforces this too (assertClassroomActive) for every mutation.
  const canModify = canManageClassroom(classroom.role) && !archived;

  return (
    <QueryView query={classwork} loading={<ClassworkLoading />} notFound={<ClassroomNotFound />}>
      {({ topics, materials, assignments }) => (
        <TopicList
          classroomId={classroom.id}
          topics={topics}
          materials={
            archived ? materials.map((material) => ({ ...material, canManage: false })) : materials
          }
          assignments={
            archived
              ? assignments.map((assignment) => ({ ...assignment, canManage: false }))
              : assignments
          }
          canManage={canModify}
        />
      )}
    </QueryView>
  );
}
