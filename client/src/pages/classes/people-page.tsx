import { useClassroomPeople } from "@/features/classroom/api";
import { InvitationSection } from "@/features/classroom/components/invitation-section";
import { RosterManager } from "@/features/classroom/components/roster-manager";
import { canManageClassroom } from "@/features/classroom/lib/can-manage";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

import { ClassroomNotFound, ClassroomTabLoading, useCurrentClassroom } from "./classroom-layout";

export default function PeoplePage() {
  const classroom = useCurrentClassroom();
  const viewerId = useSession().data?.user.id ?? "";
  const people = useClassroomPeople(classroom.id);

  const archived = classroom.status === "ARCHIVED";
  const canManage = canManageClassroom(classroom.role);
  // Inviting members is disabled while archived - the server independently
  // enforces this too (assertClassroomActive, via inviteMember).
  const canInvite = canManage && !archived;

  return (
    <QueryView query={people} loading={<ClassroomTabLoading />} notFound={<ClassroomNotFound />}>
      {({ roster, invitations }) => {
        const totalCount = roster.teachers.length + roster.students.length;
        return (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? "person" : "people"} - {roster.teachers.length}{" "}
              {roster.teachers.length === 1 ? "teacher" : "teachers"}, {roster.students.length}{" "}
              {roster.students.length === 1 ? "student" : "students"}
            </p>

            {canManage ? (
              <InvitationSection
                classroomId={classroom.id}
                classroomCode={classroom.code}
                initialInvitations={invitations}
                canInvite={canInvite}
              />
            ) : null}

            <RosterManager
              classroomId={classroom.id}
              classroomTitle={classroom.title}
              ownerId={classroom.ownerId}
              initialRoster={roster}
              viewerId={viewerId}
              canManage={canManage}
            />
          </div>
        );
      }}
    </QueryView>
  );
}
