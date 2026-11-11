import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiAction, apiGet, getApiError } from "@/lib/api";

import type {
  ActionResult,
  ScheduleOutcome,
  TimetableClassroomOption,
  SlotHourAvailability,
  TimetableClashView,
  TimetableSlotView,
} from "./types";

// ---- Queries ------------------------------------------------------------------

export function useWeeklyTimetable() {
  return useQuery({
    queryKey: ["timetable"],
    queryFn: () =>
      apiGet<{
        slots: TimetableSlotView[];
        schedulableClassrooms: TimetableClassroomOption[];
        rooms: string[];
      }>("/timetable"),
  });
}

export function useTimetableClashes(filter: "pending" | "all") {
  return useQuery({
    queryKey: ["timetable", "clashes", filter],
    queryFn: () =>
      apiGet<{ clashes: TimetableClashView[]; rooms: string[] }>("/timetable/clashes", {
        params: filter === "all" ? { status: "all" } : undefined,
      }),
    placeholderData: keepPreviousData,
  });
}

// ---- Same signatures as the old Server Actions -----------------------------------

async function getAvailability(
  url: string,
  params: Record<string, string | number | undefined>,
): Promise<ActionResult<SlotHourAvailability[]>> {
  try {
    return await apiGet<ActionResult<SlotHourAvailability[]>>(url, { params });
  } catch (error) {
    return {
      status: "error",
      message: getApiError(error)?.message ?? "Couldn't load slot availability.",
    };
  }
}

export function getSlotAvailabilityAction(input: {
  classroomId: string;
  dayOfWeek: number;
  excludeSlotId?: string;
  room?: string;
}) {
  return getAvailability("/timetable/availability", input);
}

export function getClashAvailabilityAction(input: {
  clashId: string;
  dayOfWeek: number;
  room?: string;
}) {
  return getAvailability(`/timetable/clashes/${input.clashId}/availability`, {
    dayOfWeek: input.dayOfWeek,
    room: input.room,
  });
}

export function scheduleSlotAction(input: {
  classroomId: string;
  dayOfWeek: number;
  startHour: number;
  room: string;
}) {
  return apiAction<ScheduleOutcome>(
    "post",
    "/timetable/slots",
    input,
    "Couldn't schedule the class. Please try again.",
  );
}

export function rescheduleSlotAction(input: {
  slotId: string;
  dayOfWeek: number;
  startHour: number;
  room: string;
}) {
  const { slotId, ...body } = input;
  return apiAction<ScheduleOutcome>(
    "patch",
    `/timetable/slots/${slotId}`,
    body,
    "Couldn't reschedule the class. Please try again.",
  );
}

export function cancelSlotAction(slotId: string) {
  return apiAction(
    "delete",
    `/timetable/slots/${slotId}`,
    undefined,
    "Couldn't cancel the class. Please try again.",
  );
}

export function resolveClashAction(input: {
  clashId: string;
  dayOfWeek: number;
  startHour: number;
  room: string;
}) {
  const { clashId, ...body } = input;
  return apiAction(
    "post",
    `/timetable/clashes/${clashId}/resolve`,
    body,
    "Couldn't resolve the clash. Please try again.",
  );
}

export function dismissClashAction(clashId: string) {
  return apiAction(
    "post",
    `/timetable/clashes/${clashId}/dismiss`,
    undefined,
    "Couldn't dismiss the clash. Please try again.",
  );
}
