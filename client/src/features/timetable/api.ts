import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiAction as rawApiAction, apiGet, getApiError } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

import type {
  ActionResult,
  ScheduleOutcome,
  TimetableClassroomOption,
  SlotHourAvailability,
  TimetableClashView,
  TimetableSlotView,
} from "./types";

/**
 * Every timetable change (schedule, move, cancel, resolve or dismiss a clash)
 * refreshes the timetable and clash lists on success, so pages on screen
 * update without a reload - e.g. the last resolved clash leaves "No clashes".
 */
async function apiAction<T = undefined>(...args: Parameters<typeof rawApiAction>): Promise<ActionResult<T>> {
  const result = await rawApiAction<T>(...args);
  if (result.status === "success") {
    void queryClient.invalidateQueries({ queryKey: ["timetable"] });
    // Class slots also show on the calendar and dashboard; off-screen ones just refetch on next visit.
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }
  return result;
}

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

// ---- Rooms (admin) ----------------------------------------------------------------
// Under ["timetable"], so every timetable change refreshes it and vice versa.

export interface RoomRow {
  id: string;
  number: string;
  floor: number;
  isActive: boolean;
  /** Classes booked in this room each week. */
  weeklyClasses: number;
}

export function useRooms() {
  return useQuery({
    queryKey: ["timetable", "admin-rooms"],
    queryFn: () => apiGet<{ rooms: RoomRow[] }>("/admin/rooms"),
  });
}

export function createRoomAction(number: string) {
  return apiAction<{ room: RoomRow; message: string }>(
    "post",
    "/admin/rooms",
    { number },
    "Couldn't add the room. Please try again.",
  );
}

export function setRoomActiveAction(roomId: string, isActive: boolean) {
  return apiAction("post", `/admin/rooms/${roomId}/status`, { isActive }, "Couldn't update the room. Please try again.");
}

export function deleteRoomAction(roomId: string) {
  return apiAction("delete", `/admin/rooms/${roomId}`, undefined, "Couldn't delete the room. Please try again.");
}
