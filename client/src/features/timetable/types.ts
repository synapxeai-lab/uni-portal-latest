import type { TimetableClashStatus } from "@portal/shared/enums";

export type { ActionResult } from "@/types/action-result";

export interface TimetableSlotView {
  id: string;
  classroomId: string;
  classroomTitle: string;
  section: string;
  subject: string | null;
  teacherId: string;
  teacherName: string;
  room: string;
  /** 1 = Monday .. 6 = Saturday; the class meets at this weekday + hour every week. */
  dayOfWeek: number;
  startHour: number;
  /** Whether the viewer may reschedule/cancel this slot. */
  canManage: boolean;
  /** A move request for this booking that is waiting for the admin, if any. */
  pendingMove: { dayOfWeek: number; startHour: number; room: string } | null;
}

export interface TimetableClassroomOption {
  id: string;
  title: string;
  section: string;
}

export type SlotHourState = "free" | "section_taken" | "room_taken" | "teacher_busy";

export interface SlotHourAvailability {
  hour: number;
  state: SlotHourState;
  /** For taken/busy hours: which class is occupying it. */
  occupiedBy: string | null;
  /** Every room already booked in this hour (any section), so a free room can be chosen. */
  occupiedRooms: { room: string; classroomTitle: string; section: string }[];
}

export interface TimetableClashView {
  id: string;
  status: TimetableClashStatus;
  classroomId: string;
  classroomTitle: string;
  section: string;
  requestedByName: string;
  kind: "SECTION" | "ROOM";
  /** The slot (and room) the blocked teacher asked for. */
  room: string;
  dayOfWeek: number;
  startHour: number;
  conflictingClassroomTitle: string | null;
  conflictingTeacherName: string | null;
  createdAt: Date;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  resolvedDayOfWeek: number | null;
  resolvedStartHour: number | null;
  resolvedRoom: string | null;
  /** Set when this is a move request: where the class is booked right now. */
  currentDayOfWeek: number | null;
  currentStartHour: number | null;
  currentRoom: string | null;
}

export type ScheduleOutcome =
  { outcome: "scheduled"; message: string } | { outcome: "clash"; message: string };
