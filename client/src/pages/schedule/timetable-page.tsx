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
            title={role === UserRole.ADMIN ? "Timetable" : "My timetable"}
            description={
              isTeacher
                ? "Your weekly timetable - it repeats every week. Add a class once (day, time and room) and change it whenever you need; students are notified automatically."
                : role === UserRole.ADMIN
                  ? "Every class on the weekly timetable."
                  : "Your weekly timetable - the same every week."
            }
          />

          <TimetableBoard
            slots={slots}
            schedulableClassrooms={schedulableClassrooms}
            canSchedule={isTeacher}
            showTeacher={!isTeacher}
            rooms={rooms}
            today={todayDayOfWeek()}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
