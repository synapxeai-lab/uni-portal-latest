import { useMemo } from "react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { useCalendarPage } from "@/features/calendar/api";
import { CalendarDayView } from "@/features/calendar/components/calendar-day-view";
import { CalendarEventDetailsDialog } from "@/features/calendar/components/calendar-event-details-dialog";
import { CalendarFilterBar } from "@/features/calendar/components/calendar-filter-bar";
import { CalendarMonthView } from "@/features/calendar/components/calendar-month-view";
import { CalendarSidebar } from "@/features/calendar/components/calendar-sidebar";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { CalendarWeekView } from "@/features/calendar/components/calendar-week-view";
import { CalendarEventDialogProvider } from "@/features/calendar/context/calendar-event-dialog-context";
import {
  addDays,
  endOfDay,
  endOfMonth,
  getRangeForView,
  startOfDay,
  startOfMonth,
} from "@/features/calendar/lib/calendar-date";
import { formatMonthTitle } from "@/features/calendar/lib/calendar-format";
import { parseCalendarParams, type RawSearchParams } from "@/features/calendar/lib/calendar-params";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSearchParams } from "@/lib/navigation";

const UPCOMING_WINDOW_DAYS = 14;
const UPCOMING_EVENTS_LIMIT = 8;

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { view, date, classroomId, eventTypes } = useMemo(
    () => parseCalendarParams(Object.fromEntries(new URLSearchParams(search)) as RawSearchParams),
    [search],
  );

  // All ranges are computed here, in the viewer's own time zone.
  const query = useMemo(() => {
    const now = new Date();
    return {
      gridRange: getRangeForView(date, view),
      todayRange: { start: startOfDay(now), end: endOfDay(now) },
      upcomingRange: {
        start: startOfDay(addDays(now, 1)),
        end: endOfDay(addDays(now, UPCOMING_WINDOW_DAYS)),
      },
      monthRange: { start: startOfMonth(date), end: endOfMonth(date) },
      classroomId,
      eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
    };
  }, [date, view, classroomId, eventTypes]);

  const calendar = useCalendarPage(query);
  const filters = { classroomId, eventTypes };

  return (
    <QueryView query={calendar} loading={<AppLoading />}>
      {({ events, todayEvents, upcomingEvents, monthAgendaEvents, filterOptions }) => (
        <CalendarEventDialogProvider>
          <PageContainer>
            <SectionHeader
              title="Calendar"
              description="Due dates and classroom events, aggregated across all your classes."
            />
            <CalendarFilterBar
              classrooms={filterOptions.classrooms}
              classroomId={classroomId}
              eventTypes={eventTypes}
            />
            {/* The sidebar only sits beside the grid on very wide screens - next to
                the app sidebar it would otherwise squeeze the 7-column grid. */}
            <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <CalendarToolbar
                  date={date}
                  view={view}
                  range={query.gridRange}
                  classroomId={classroomId}
                  eventTypes={eventTypes}
                />
                {view === "month" ? (
                  <CalendarMonthView date={date} events={events} filters={filters} />
                ) : null}
                {view === "week" ? (
                  <CalendarWeekView date={date} events={events} filters={filters} />
                ) : null}
                {view === "day" ? <CalendarDayView date={date} events={events} /> : null}
              </div>
              <CalendarSidebar
                todayEvents={todayEvents}
                upcomingEvents={upcomingEvents.slice(0, UPCOMING_EVENTS_LIMIT)}
                monthEvents={monthAgendaEvents}
                monthLabel={formatMonthTitle(date)}
              />
            </div>
            <CalendarEventDetailsDialog />
          </PageContainer>
        </CalendarEventDialogProvider>
      )}
    </QueryView>
  );
}
