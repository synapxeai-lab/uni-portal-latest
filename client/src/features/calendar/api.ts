import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";

import type { CalendarEvent, CalendarEventType, CalendarRange } from "./types";

export interface CalendarFilterOptions {
  classrooms: { id: string; title: string }[];
}

export interface CalendarPageData {
  events: CalendarEvent[];
  todayEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  monthAgendaEvents: CalendarEvent[];
  filterOptions: CalendarFilterOptions;
}

export interface CalendarPageQuery {
  gridRange: CalendarRange;
  todayRange: CalendarRange;
  upcomingRange: CalendarRange;
  monthRange: CalendarRange;
  classroomId?: string;
  eventTypes?: CalendarEventType[];
}

/**
 * The Calendar page's data. Every range is computed in the browser - in the
 * viewer's own time zone - and sent as exact instants.
 */
export function useCalendarPage(query: CalendarPageQuery) {
  const params = {
    gridStart: query.gridRange.start.toISOString(),
    gridEnd: query.gridRange.end.toISOString(),
    todayStart: query.todayRange.start.toISOString(),
    todayEnd: query.todayRange.end.toISOString(),
    upcomingStart: query.upcomingRange.start.toISOString(),
    upcomingEnd: query.upcomingRange.end.toISOString(),
    monthStart: query.monthRange.start.toISOString(),
    monthEnd: query.monthRange.end.toISOString(),
    classroomId: query.classroomId,
    types: query.eventTypes?.join(",") || undefined,
  };

  return useQuery({
    queryKey: ["calendar", params],
    queryFn: () => apiGet<CalendarPageData>("/calendar", { params }),
    // Paging months/weeks keeps the current grid on screen until the next arrives.
    placeholderData: keepPreviousData,
  });
}
