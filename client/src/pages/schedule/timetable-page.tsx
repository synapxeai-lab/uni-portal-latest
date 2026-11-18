import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { UserRole } from "@portal/shared/enums";
import { useWeeklyTimetable } from "@/features/timetable/api";
import { TimetableBoard } from "@/features/timetable/components/timetable-board";
import { todayDayOfWeek } from "@/features/timetable/lib/slots";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";

export default function TimetablePage() {
  const role = useSession().data?.user.role;
  const timetable = useWeeklyTimetable();
  const isTeacher = role === UserRole.TEACHER;

  return (
    <QueryView query={timetable} loading={<AppLoading />}>
      {({ slots, schedulableClassrooms, rooms }) => (
        <PageContainer>
          <SectionHeader
            title="Timetable"
            description={
              isTeacher
                ? "The institute's weekly timetable: every class, by room and hour. It repeats every week. Your classes are outlined; click a free cell to book that room, and students are notified automatically."
                : role === UserRole.ADMIN
                  ? "The institute's weekly timetable: every class, by room and hour."
                  : "The institute's weekly timetable, by room and hour. Your classes are outlined."
            }
          />

          <TimetableBoard
            slots={slots}
            schedulableClassrooms={schedulableClassrooms}
            canSchedule={isTeacher}
            rooms={rooms}
            today={todayDayOfWeek()}
            hasOwnClasses={role !== UserRole.ADMIN}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
