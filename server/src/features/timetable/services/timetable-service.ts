import type { SessionUser } from "@/auth/session";
import {
  assertClassroomActive,
  assertManagementAccess,
  loadActiveClassroom,
} from "@/features/classroom/services/classroom-service";
import {
  notifyTimeslotCancelled,
  notifyTimeslotClash,
  notifyTimeslotClashReported,
  notifyTimeslotResolved,
  notifyTimeslotScheduled,
  notifyTimeslotUpdated,
} from "@/features/notifications/services/notification-generator";
import { Prisma } from "@/generated/prisma/client";
import {
  ActivityAction,
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  TimetableClashKind,
  TimetableClashStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

import { TimetableServiceError } from "../lib/errors";
import {
  SLOT_START_HOURS,
  ROOM_FORMAT_MESSAGE,
  UNASSIGNED_SECTION,
  formatSlot,
  isValidDay,
  isValidRoom,
  isValidSlotHour,
  toRoomKey,
  toSectionKey,
} from "../lib/slots";
import type {
  ScheduleOutcome,
  SlotHourAvailability,
  TimetableClashView,
  TimetableClassroomOption,
  TimetableSlotView,
} from "../types";

const MANAGER_ROLES = [
  ClassroomMembershipRole.OWNER,
  ClassroomMembershipRole.TEACHER,
  ClassroomMembershipRole.CO_TEACHER,
];

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Validates a requested weekday + hour and returns the weekday. Throws a user-facing error otherwise. */
function validateDayHour(dayOfWeek: number, startHour: number): number {
  if (!isValidDay(dayOfWeek)) {
    throw new TimetableServiceError("VALIDATION_ERROR", "Classes run Monday to Saturday.");
  }
  if (!isValidSlotHour(startHour)) {
    throw new TimetableServiceError(
      "VALIDATION_ERROR",
      "Classes run between 8:00 AM and 5:00 PM in one-hour slots.",
    );
  }
  return dayOfWeek;
}

function assertSectionAssigned(section: string): string {
  const key = toSectionKey(section);
  if (!key || key === toSectionKey(UNASSIGNED_SECTION)) {
    throw new TimetableServiceError(
      "SECTION_NOT_SET",
      "This class has no section yet. Edit the class and set its section before scheduling.",
    );
  }
  return key;
}

/** Rooms are exactly three digits (floor digit + two-digit room); anything else is rejected. */
function normalizeRoom(room: string): { room: string; roomKey: string } {
  const label = room.trim();
  if (!label) {
    throw new TimetableServiceError("VALIDATION_ERROR", "Enter the room number.");
  }
  if (!isValidRoom(label)) {
    throw new TimetableServiceError("VALIDATION_ERROR", ROOM_FORMAT_MESSAGE);
  }
  return { room: label, roomKey: toRoomKey(label) };
}

/** Rooms must come from the registered room list (and be active). */
async function assertRoomRegistered(room: string): Promise<void> {
  const registered = await prisma.room.findFirst({
    where: { number: room, isActive: true },
    select: { id: true },
  });
  if (!registered) {
    throw new TimetableServiceError(
      "VALIDATION_ERROR",
      `Room ${room} isn't a registered room. Pick one from the room list.`,
    );
  }
}

/** Active registered room numbers, ascending - feeds the room pickers. */
export async function listActiveRooms(): Promise<string[]> {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  return rooms.map((room) => room.number);
}

function slotLabelOf(slot: { dayOfWeek: number; startHour: number }): string {
  return formatSlot(slot.dayOfWeek, slot.startHour);
}

const slotWithDetailsInclude = {
  classroom: { select: { id: true, title: true, section: true, subject: true } },
  teacher: { select: { id: true, name: true } },
} as const;

type SlotWithDetails = Prisma.TimetableSlotGetPayload<{ include: typeof slotWithDetailsInclude }>;

function toSlotView(
  slot: SlotWithDetails,
  canManage: boolean,
  pendingMove: TimetableSlotView["pendingMove"] = null,
): TimetableSlotView {
  return {
    id: slot.id,
    classroomId: slot.classroomId,
    classroomTitle: slot.classroom.title,
    section: slot.classroom.section,
    subject: slot.classroom.subject,
    teacherId: slot.teacherId,
    teacherName: slot.teacher.name,
    room: slot.room,
    dayOfWeek: slot.dayOfWeek,
    startHour: slot.startHour,
    canManage,
    pendingMove,
  };
}

/** Finds whatever currently occupies the section / teacher / room at a slot, ignoring `excludeSlotId`. */
async function findOccupants(params: {
  sectionKey: string;
  roomKey: string;
  teacherId: string;
  dayOfWeek: number;
  startHour: number;
  excludeSlotId?: string;
}) {
  const [sectionSlot, teacherSlot, roomSlot] = await Promise.all([
    prisma.timetableSlot.findUnique({
      where: {
        sectionKey_dayOfWeek_startHour: {
          sectionKey: params.sectionKey,
          dayOfWeek: params.dayOfWeek,
          startHour: params.startHour,
        },
      },
      include: slotWithDetailsInclude,
    }),
    prisma.timetableSlot.findUnique({
      where: {
        teacherId_dayOfWeek_startHour: {
          teacherId: params.teacherId,
          dayOfWeek: params.dayOfWeek,
          startHour: params.startHour,
        },
      },
      include: slotWithDetailsInclude,
    }),
    prisma.timetableSlot.findUnique({
      where: {
        roomKey_dayOfWeek_startHour: {
          roomKey: params.roomKey,
          dayOfWeek: params.dayOfWeek,
          startHour: params.startHour,
        },
      },
      include: slotWithDetailsInclude,
    }),
  ]);

  return {
    sectionSlot: sectionSlot && sectionSlot.id !== params.excludeSlotId ? sectionSlot : null,
    teacherSlot: teacherSlot && teacherSlot.id !== params.excludeSlotId ? teacherSlot : null,
    roomSlot: roomSlot && roomSlot.id !== params.excludeSlotId ? roomSlot : null,
  };
}

function teacherBusyError(slot: SlotWithDetails): TimetableServiceError {
  return new TimetableServiceError(
    "TEACHER_BUSY",
    `You already teach ${slot.classroom.title} (Section ${slot.classroom.section}) at that time. Pick a different slot.`,
  );
}

function roomTakenError(slot: SlotWithDetails): TimetableServiceError {
  return new TimetableServiceError(
    "ROOM_TAKEN",
    `Room ${slot.room} is already in use by ${slot.classroom.title} (Section ${slot.classroom.section}) at that time. Pick a different room or slot.`,
  );
}

/** A concurrent booking grabbed the slot/room between our check and our write. */
function justTakenError(): TimetableServiceError {
  return new TimetableServiceError(
    "SLOT_TAKEN",
    "That slot or room was just taken by another booking. Pick a different slot or room.",
  );
}

function sectionTakenError(sectionLabel: string): TimetableServiceError {
  return new TimetableServiceError(
    "SLOT_TAKEN",
    `Section ${sectionLabel} already has a class in that slot. Pick a different slot.`,
  );
}

/**
 * A teacher books a one-hour slot for one of their classes.
 *
 * - Free slot: it's saved and the classroom's students are notified.
 * - Section already has a class then, or the room is already in use: nothing
 *   is booked, but the teacher is NOT turned away. A clash record is opened
 *   (once per class/slot), the admins are notified, and the teacher is told the
 *   request went to the admin, who moves the class to a free slot. The existing
 *   booking is untouched.
 * - Teacher already teaching elsewhere then: rejected outright (a teacher can't
 *   be in two places at once - that's the teacher's own conflict, not a clash).
 */
export async function scheduleSlot(
  user: SessionUser,
  input: { classroomId: string; dayOfWeek: number; startHour: number; room: string },
): Promise<ScheduleOutcome> {
  const classroom = await loadActiveClassroom(input.classroomId);
  assertClassroomActive(classroom, "This class is archived - restore it before scheduling.");
  await assertManagementAccess(input.classroomId, user);

  const sectionKey = assertSectionAssigned(classroom.section);
  const dayOfWeek = validateDayHour(input.dayOfWeek, input.startHour);
  const { room, roomKey } = normalizeRoom(input.room);
  await assertRoomRegistered(room);

  // Two attempts: the second only runs if a concurrent booking won the race for
  // the same slot between our check and our insert (unique constraint -> P2002),
  // in which case the re-check below turns the lost race into a regular clash.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { sectionSlot, teacherSlot, roomSlot } = await findOccupants({
      sectionKey,
      roomKey,
      teacherId: user.id,
      dayOfWeek,
      startHour: input.startHour,
    });

    if (sectionSlot) {
      if (sectionSlot.classroomId === classroom.id) {
        throw new TimetableServiceError(
          "ALREADY_SCHEDULED",
          "This class is already scheduled for that slot.",
        );
      }
      return openClash({
        user,
        classroom,
        sectionKey,
        dayOfWeek,
        startHour: input.startHour,
        room,
        kind: TimetableClashKind.SECTION,
        conflictingSlot: sectionSlot,
      });
    }

    if (teacherSlot) {
      throw teacherBusyError(teacherSlot);
    }

    if (roomSlot) {
      return openClash({
        user,
        classroom,
        sectionKey,
        dayOfWeek,
        startHour: input.startHour,
        room,
        kind: TimetableClashKind.ROOM,
        conflictingSlot: roomSlot,
      });
    }

    try {
      await prisma.timetableSlot.create({
        data: {
          classroomId: classroom.id,
          teacherId: user.id,
          sectionKey,
          room,
          roomKey,
          dayOfWeek,
          startHour: input.startHour,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt === 0) {
        continue;
      }
      if (isUniqueConstraintError(error)) {
        throw justTakenError();
      }
      throw error;
    }

    const label = formatSlot(dayOfWeek, input.startHour);
    await notifyTimeslotScheduled({
      classroomId: classroom.id,
      classroomTitle: classroom.title,
      teacherId: user.id,
      slotLabel: label,
      room,
    });

    return {
      outcome: "scheduled",
      message: `${classroom.title} scheduled for ${label} in Room ${room}.`,
    };
  }

  throw justTakenError();
}

async function openClash(params: {
  user: SessionUser;
  classroom: { id: string; title: string; section: string };
  sectionKey: string;
  dayOfWeek: number;
  startHour: number;
  room: string;
  kind: TimetableClashKind;
  conflictingSlot: SlotWithDetails;
  /** The existing booking being moved, when this clash comes from a reschedule. */
  rescheduleSlot?: SlotWithDetails;
}): Promise<ScheduleOutcome> {
  const { user, classroom, conflictingSlot, rescheduleSlot } = params;
  const label = formatSlot(params.dayOfWeek, params.startHour);
  const movingFrom = rescheduleSlot
    ? `${slotLabelOf(rescheduleSlot)} (Room ${rescheduleSlot.room})`
    : undefined;
  const other = conflictingSlot.classroom.title;
  const reason =
    params.kind === TimetableClashKind.ROOM
      ? `Room ${params.room} is already in use by ${other}.`
      : `Section ${classroom.section} already has ${other}.`;

  // One open move request per booking at a time - otherwise two resolutions
  // could move the same class twice.
  if (rescheduleSlot) {
    const openMove = await prisma.timetableClash.findFirst({
      where: { rescheduleSlotId: rescheduleSlot.id, status: TimetableClashStatus.PENDING },
      select: { id: true },
    });
    if (openMove) {
      throw new TimetableServiceError(
        "ALREADY_SCHEDULED",
        "This class already has a move request waiting for the admin. Wait for that decision first.",
      );
    }
  }

  // Re-submitting the same blocked request shouldn't spam admins with duplicates.
  const existing = rescheduleSlot
    ? null
    : await prisma.timetableClash.findFirst({
        where: {
          classroomId: classroom.id,
          dayOfWeek: params.dayOfWeek,
          startHour: params.startHour,
          status: TimetableClashStatus.PENDING,
          rescheduleSlotId: null,
        },
        select: { id: true },
      });

  if (!existing) {
    const clash = await prisma.timetableClash.create({
      data: {
        classroomId: classroom.id,
        requestedById: user.id,
        conflictingSlotId: conflictingSlot.id,
        sectionKey: params.sectionKey,
        room: params.room,
        kind: params.kind,
        dayOfWeek: params.dayOfWeek,
        startHour: params.startHour,
        rescheduleSlotId: rescheduleSlot?.id ?? null,
      },
    });

    await notifyTimeslotClashReported({
      teacherId: user.id,
      classroomTitle: classroom.title,
      slotLabel: label,
      room: params.room,
      reason,
      movingFrom,
    });

    await notifyTimeslotClash({
      clashId: clash.id,
      classroomTitle: classroom.title,
      section: classroom.section,
      teacherName: user.name ?? "A teacher",
      slotLabel: label,
      room: params.room,
      kind: params.kind,
      conflictingClassroomTitle: conflictingSlot.classroom.title,
      movingFrom,
    });
  }

  return {
    outcome: "clash",
    message: movingFrom
      ? `${reason} Your request to move ${classroom.title} to ${label} (Room ${params.room}) has been sent to the admin. Your class stays at ${movingFrom} until the admin decides - you'll be notified.`
      : `${reason} Your request for ${classroom.title} on ${label} (Room ${params.room}) has been sent to the admin to resolve. Please wait - you'll be notified once the admin moves it to a free slot.`,
  };
}

async function loadManageableSlot(user: SessionUser, slotId: string) {
  const slot = await prisma.timetableSlot.findUnique({
    where: { id: slotId },
    include: slotWithDetailsInclude,
  });

  if (!slot) {
    throw new TimetableServiceError("NOT_FOUND", "That timetable slot no longer exists.");
  }

  if (user.role !== UserRole.ADMIN && slot.teacherId !== user.id) {
    throw new TimetableServiceError("FORBIDDEN", "You can only change your own timetable slots.");
  }

  return slot;
}

/**
 * Moves a teacher's own slot. A free target is applied immediately. If the
 * target clashes (section already has a class, or the room is taken), nothing
 * moves yet: a move request goes to the admin, the class keeps its current slot,
 * and the admin either resolves it (moving the booking) or dismisses it.
 * The teacher being double-booked is still rejected outright.
 */
export async function rescheduleSlot(
  user: SessionUser,
  input: { slotId: string; dayOfWeek: number; startHour: number; room: string },
): Promise<ScheduleOutcome> {
  const slot = await loadManageableSlot(user, input.slotId);
  const classroom = await loadActiveClassroom(slot.classroomId);
  assertClassroomActive(classroom, "This class is archived - restore it before rescheduling.");
  if (user.role !== UserRole.ADMIN) {
    await assertManagementAccess(slot.classroomId, user);
  }

  // While a move request is with the admin, the booking is frozen - otherwise the
  // admin's decision would apply to a class that has already moved elsewhere.
  const pendingMove = await prisma.timetableClash.findFirst({
    where: { rescheduleSlotId: slot.id, status: TimetableClashStatus.PENDING },
    select: { id: true },
  });
  if (pendingMove) {
    throw new TimetableServiceError(
      "ALREADY_SCHEDULED",
      "This class already has a move request waiting for the admin. Wait for that decision first.",
    );
  }

  const sectionKey = assertSectionAssigned(classroom.section);
  const dayOfWeek = validateDayHour(input.dayOfWeek, input.startHour);
  const { room, roomKey } = normalizeRoom(input.room);
  await assertRoomRegistered(room);

  if (
    dayOfWeek === slot.dayOfWeek &&
    input.startHour === slot.startHour &&
    roomKey === slot.roomKey
  ) {
    throw new TimetableServiceError(
      "VALIDATION_ERROR",
      "That's already this class's slot and room.",
    );
  }

  const { sectionSlot, teacherSlot, roomSlot } = await findOccupants({
    sectionKey,
    roomKey,
    teacherId: slot.teacherId,
    dayOfWeek,
    startHour: input.startHour,
    excludeSlotId: slot.id,
  });

  if (sectionSlot?.classroomId === slot.classroomId) {
    throw new TimetableServiceError(
      "ALREADY_SCHEDULED",
      "This class already has another booking at that time.",
    );
  }

  // The admin is the one who resolves clashes, so an admin's own move is simply refused.
  const isAdmin = user.role === UserRole.ADMIN;

  if (sectionSlot) {
    if (isAdmin) {
      throw sectionTakenError(classroom.section);
    }
    return openClash({
      user,
      classroom,
      sectionKey,
      dayOfWeek,
      startHour: input.startHour,
      room,
      kind: TimetableClashKind.SECTION,
      conflictingSlot: sectionSlot,
      rescheduleSlot: slot,
    });
  }
  if (teacherSlot) {
    throw teacherBusyError(teacherSlot);
  }
  if (roomSlot) {
    if (isAdmin) {
      throw roomTakenError(roomSlot);
    }
    return openClash({
      user,
      classroom,
      sectionKey,
      dayOfWeek,
      startHour: input.startHour,
      room,
      kind: TimetableClashKind.ROOM,
      conflictingSlot: roomSlot,
      rescheduleSlot: slot,
    });
  }

  try {
    await prisma.timetableSlot.update({
      where: { id: slot.id },
      data: { dayOfWeek, startHour: input.startHour, sectionKey, room, roomKey },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw justTakenError();
    }
    throw error;
  }

  const newLabel = formatSlot(dayOfWeek, input.startHour);
  await notifyTimeslotUpdated({
    classroomId: classroom.id,
    classroomTitle: classroom.title,
    teacherId: slot.teacherId,
    oldSlotLabel: slotLabelOf(slot),
    oldRoom: slot.room,
    newSlotLabel: newLabel,
    newRoom: room,
  });

  return {
    outcome: "scheduled",
    message: `${classroom.title} moved to ${newLabel} in Room ${room}.`,
  };
}

export async function cancelSlot(user: SessionUser, slotId: string): Promise<void> {
  const slot = await loadManageableSlot(user, slotId);

  await prisma.timetableSlot.delete({ where: { id: slot.id } });

  await notifyTimeslotCancelled({
    classroomId: slot.classroomId,
    classroomTitle: slot.classroom.title,
    teacherId: slot.teacherId,
    slotLabel: slotLabelOf(slot),
    room: slot.room,
  });
}

/**
 * Which hours of a weekday are free for this class: not held by another class in
 * the same section, not clashing with the teacher's other classes and (when a
 * room is given) not using that room. Pure information for the UI - the real
 * guarantee is the check + unique constraints in scheduleSlot / rescheduleSlot /
 * resolveClash.
 */
async function computeAvailability(params: {
  sectionKey: string;
  /** Normalized room to check; omit to skip the room check. */
  roomKey?: string;
  teacherId: string;
  dayOfWeek: number;
  excludeSlotId?: string;
}): Promise<SlotHourAvailability[]> {
  if (!isValidDay(params.dayOfWeek)) {
    throw new TimetableServiceError("VALIDATION_ERROR", "Classes run Monday to Saturday.");
  }

  // Every booking on that weekday, across all sections - one query that serves the
  // section, teacher and room checks and lists which rooms are taken each hour.
  const daySlots = (
    await prisma.timetableSlot.findMany({
      where: { dayOfWeek: params.dayOfWeek },
      include: slotWithDetailsInclude,
      orderBy: { room: "asc" },
    })
  ).filter((slot) => slot.id !== params.excludeSlotId);

  const sectionSlots = daySlots.filter((slot) => slot.sectionKey === params.sectionKey);
  const teacherSlots = daySlots.filter((slot) => slot.teacherId === params.teacherId);
  const roomSlots = params.roomKey
    ? daySlots.filter((slot) => slot.roomKey === params.roomKey)
    : [];

  return SLOT_START_HOURS.map((hour): SlotHourAvailability => {
    const occupiedRooms = daySlots
      .filter((slot) => slot.startHour === hour)
      .map((slot) => ({
        room: slot.room,
        classroomTitle: slot.classroom.title,
        section: slot.classroom.section,
      }));

    const sectionSlot = sectionSlots.find((slot) => slot.startHour === hour);
    if (sectionSlot) {
      return {
        hour,
        state: "section_taken",
        occupiedBy: sectionSlot.classroom.title,
        occupiedRooms,
      };
    }

    const teacherSlot = teacherSlots.find((slot) => slot.startHour === hour);
    if (teacherSlot) {
      return {
        hour,
        state: "teacher_busy",
        occupiedBy: teacherSlot.classroom.title,
        occupiedRooms,
      };
    }

    const roomSlot = roomSlots.find((slot) => slot.startHour === hour);
    if (roomSlot) {
      return { hour, state: "room_taken", occupiedBy: roomSlot.classroom.title, occupiedRooms };
    }

    return { hour, state: "free", occupiedBy: null, occupiedRooms };
  });
}

export async function getSlotAvailability(
  user: SessionUser,
  input: { classroomId: string; dayOfWeek: number; excludeSlotId?: string; room?: string },
): Promise<SlotHourAvailability[]> {
  const classroom = await loadActiveClassroom(input.classroomId);
  await assertManagementAccess(input.classroomId, user);

  return computeAvailability({
    sectionKey: toSectionKey(classroom.section),
    roomKey: input.room && isValidRoom(input.room) ? toRoomKey(input.room) : undefined,
    teacherId: user.id,
    dayOfWeek: input.dayOfWeek,
    excludeSlotId: input.excludeSlotId,
  });
}

/** Active classrooms the teacher manages and can schedule (section already set). */
export async function listSchedulableClassrooms(
  user: SessionUser,
): Promise<TimetableClassroomOption[]> {
  const memberships = await prisma.classroomMembership.findMany({
    where: {
      userId: user.id,
      status: ClassroomMembershipStatus.ACTIVE,
      role: { in: MANAGER_ROLES },
      classroom: { status: ClassroomStatus.ACTIVE },
    },
    select: { classroom: { select: { id: true, title: true, section: true } } },
    orderBy: { classroom: { title: "asc" } },
  });

  return memberships
    .map((membership) => membership.classroom)
    .filter((classroom) => toSectionKey(classroom.section) !== toSectionKey(UNASSIGNED_SECTION));
}

/**
 * The viewer's weekly timetable (it repeats every week):
 *  - teacher: the classes they teach themselves - their personal timetable
 *  - student: every class they're an active member of (view only)
 *  - admin: every class on the timetable
 */
export async function listWeeklyTimetable(user: SessionUser): Promise<TimetableSlotView[]> {
  let viewerFilter: Prisma.TimetableSlotWhereInput;
  if (user.role === UserRole.ADMIN) {
    viewerFilter = {};
  } else if (user.role === UserRole.TEACHER) {
    viewerFilter = { teacherId: user.id };
  } else {
    const memberships = await prisma.classroomMembership.findMany({
      where: { userId: user.id, status: ClassroomMembershipStatus.ACTIVE },
      select: { classroomId: true },
    });
    viewerFilter = { classroomId: { in: memberships.map((m) => m.classroomId) } };
  }

  const slots = await prisma.timetableSlot.findMany({
    where: { ...viewerFilter, classroom: { status: ClassroomStatus.ACTIVE } },
    include: {
      ...slotWithDetailsInclude,
      moveRequests: {
        where: { status: TimetableClashStatus.PENDING },
        select: { dayOfWeek: true, startHour: true, room: true },
        take: 1,
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
    take: 1000,
  });

  return slots.map((slot) => {
    const canManage = user.role === UserRole.ADMIN || slot.teacherId === user.id;
    const move = slot.moveRequests[0];
    return toSlotView(
      slot,
      canManage,
      canManage && move
        ? { dayOfWeek: move.dayOfWeek, startHour: move.startHour, room: move.room }
        : null,
    );
  });
}

// ---------------------------------------------------------------------------
// Admin: clash review
// ---------------------------------------------------------------------------

const clashDetailsInclude = {
  classroom: { select: { id: true, title: true, section: true } },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { name: true } },
  conflictingSlot: {
    select: {
      classroom: { select: { title: true } },
      teacher: { select: { id: true, name: true } },
    },
  },
  resolvedSlot: { select: { dayOfWeek: true, startHour: true, room: true } },
  rescheduleSlot: { include: slotWithDetailsInclude },
} as const;

type ClashWithDetails = Prisma.TimetableClashGetPayload<{ include: typeof clashDetailsInclude }>;

function toClashView(clash: ClashWithDetails): TimetableClashView {
  return {
    id: clash.id,
    status: clash.status,
    classroomId: clash.classroomId,
    classroomTitle: clash.classroom.title,
    section: clash.classroom.section,
    requestedByName: clash.requestedBy.name,
    kind: clash.kind,
    room: clash.room,
    dayOfWeek: clash.dayOfWeek,
    startHour: clash.startHour,
    conflictingClassroomTitle: clash.conflictingSlot?.classroom.title ?? null,
    conflictingTeacherName: clash.conflictingSlot?.teacher.name ?? null,
    createdAt: clash.createdAt,
    resolvedByName: clash.resolvedBy?.name ?? null,
    resolvedAt: clash.resolvedAt,
    resolvedDayOfWeek: clash.resolvedSlot?.dayOfWeek ?? null,
    resolvedStartHour: clash.resolvedSlot?.startHour ?? null,
    resolvedRoom: clash.resolvedSlot?.room ?? null,
    currentDayOfWeek: clash.rescheduleSlot?.dayOfWeek ?? null,
    currentStartHour: clash.rescheduleSlot?.startHour ?? null,
    currentRoom: clash.rescheduleSlot?.room ?? null,
  };
}

export async function listClashes(filter: "pending" | "all"): Promise<TimetableClashView[]> {
  const clashes = await prisma.timetableClash.findMany({
    where: filter === "pending" ? { status: TimetableClashStatus.PENDING } : {},
    include: clashDetailsInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return clashes.map(toClashView);
}

async function loadPendingClash(clashId: string) {
  const clash = await prisma.timetableClash.findUnique({
    where: { id: clashId },
    include: clashDetailsInclude,
  });

  if (!clash) {
    throw new TimetableServiceError("NOT_FOUND", "That clash no longer exists.");
  }
  if (clash.status !== TimetableClashStatus.PENDING) {
    throw new TimetableServiceError("CLASH_NOT_PENDING", "This clash has already been handled.");
  }

  return clash;
}

/** Availability of a given date for the *blocked* class in a clash - drives the admin's slot picker. */
export async function getClashAvailability(
  clashId: string,
  dayOfWeek: number,
  room?: string,
): Promise<SlotHourAvailability[]> {
  const clash = await loadPendingClash(clashId);

  return computeAvailability({
    sectionKey: toSectionKey(clash.classroom.section),
    roomKey: room && isValidRoom(room) ? toRoomKey(room) : undefined,
    teacherId: clash.rescheduleSlot?.teacherId ?? clash.requestedById,
    dayOfWeek,
    // A move request's own booking mustn't block the slots it could move to.
    excludeSlotId: clash.rescheduleSlotId ?? undefined,
  });
}

/**
 * Admin resolves a clash by moving the blocked class to a free slot. For a new
 * booking the class is booked there; for a move request the existing booking is
 * moved there. The class that already held the contested slot is never
 * displaced. The clash is closed, and then:
 *  - the blocked teacher is told which slot their class was moved to,
 *  - the teacher who already held the contested slot is told the clash is
 *    settled and where the other class went,
 *  - the blocked class's students are told when their class is scheduled.
 */
export async function resolveClash(
  admin: SessionUser,
  input: { clashId: string; dayOfWeek: number; startHour: number; room: string },
): Promise<void> {
  const clash = await loadPendingClash(input.clashId);
  const classroom = await loadActiveClassroom(clash.classroomId);
  assertClassroomActive(classroom, "This class is archived - restore it before scheduling.");

  const sectionKey = assertSectionAssigned(classroom.section);
  const dayOfWeek = validateDayHour(input.dayOfWeek, input.startHour);
  const { room, roomKey } = normalizeRoom(input.room);
  await assertRoomRegistered(room);

  const moving = clash.rescheduleSlot;
  const teacherId = moving?.teacherId ?? clash.requestedById;

  const { sectionSlot, teacherSlot, roomSlot } = await findOccupants({
    sectionKey,
    roomKey,
    teacherId,
    dayOfWeek,
    startHour: input.startHour,
    excludeSlotId: moving?.id,
  });
  if (sectionSlot) {
    throw sectionTakenError(classroom.section);
  }
  if (teacherSlot) {
    throw new TimetableServiceError(
      "TEACHER_BUSY",
      `${clash.requestedBy.name} already teaches ${teacherSlot.classroom.title} at that time. Pick a different slot.`,
    );
  }
  if (roomSlot) {
    throw roomTakenError(roomSlot);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const target = moving
        ? await tx.timetableSlot.update({
            where: { id: moving.id },
            data: { sectionKey, room, roomKey, dayOfWeek, startHour: input.startHour },
          })
        : await tx.timetableSlot.create({
            data: {
              classroomId: classroom.id,
              teacherId,
              sectionKey,
              room,
              roomKey,
              dayOfWeek,
              startHour: input.startHour,
            },
          });

      // Guarded on PENDING so two admins resolving the same clash can't both win.
      const closed = await tx.timetableClash.updateMany({
        where: { id: clash.id, status: TimetableClashStatus.PENDING },
        data: {
          status: TimetableClashStatus.RESOLVED,
          resolvedById: admin.id,
          resolvedSlotId: target.id,
          resolvedAt: new Date(),
        },
      });
      if (closed.count !== 1) {
        throw new TimetableServiceError(
          "CLASH_NOT_PENDING",
          "This clash has already been handled.",
        );
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw justTakenError();
    }
    throw error;
  }

  const requestedLabel = formatSlot(clash.dayOfWeek, clash.startHour);
  const newLabel = formatSlot(dayOfWeek, input.startHour);

  await recordAuditEvent({
    actorId: admin.id,
    action: ActivityAction.UPDATED,
    entityType: "TimetableClash",
    entityId: clash.id,
    targetLabel: `${classroom.title} (Section ${classroom.section}): ${requestedLabel} (Room ${clash.room}) -> ${newLabel} (Room ${room})`,
    classroomId: classroom.id,
  }).catch((error) => console.error("Failed to record timetable clash audit event:", error));

  const movedFrom = moving ? `${slotLabelOf(moving)} (Room ${moving.room})` : null;

  await notifyTimeslotResolved({
    teacherIds: [clash.requestedById],
    message: movedFrom
      ? `Your request to move ${classroom.title} (Section ${classroom.section}) to ${requestedLabel} clashed and was resolved by the admin. Your class has been moved from ${movedFrom} to ${newLabel} in Room ${room}.`
      : `The clash for ${classroom.title} (Section ${classroom.section}) on ${requestedLabel} was resolved by the admin. Your class has been moved to ${newLabel} in Room ${room}.`,
  });

  const holder = clash.conflictingSlot?.teacher;
  if (holder && holder.id !== clash.requestedById) {
    await notifyTimeslotResolved({
      teacherIds: [holder.id],
      message: `The clash on ${requestedLabel} for Section ${classroom.section} was resolved by the admin. ${classroom.title} was moved to ${newLabel} (Room ${room}); ${clash.conflictingSlot?.classroom.title ?? "your class"} keeps its slot.`,
    });
  }

  if (moving) {
    await notifyTimeslotUpdated({
      classroomId: classroom.id,
      classroomTitle: classroom.title,
      teacherId,
      oldSlotLabel: slotLabelOf(moving),
      oldRoom: moving.room,
      newSlotLabel: newLabel,
      newRoom: room,
    });
  } else {
    await notifyTimeslotScheduled({
      classroomId: classroom.id,
      classroomTitle: classroom.title,
      teacherId,
      slotLabel: newLabel,
      room,
      scheduledByAdmin: true,
    });
  }
}

/**
 * Admin declines a clash: first come, first served. The class that already
 * holds the slot keeps it, the blocked class is simply not scheduled, and the
 * teacher who asked for it is told so (and can book another slot themselves).
 */
export async function dismissClash(admin: SessionUser, clashId: string): Promise<void> {
  const clash = await loadPendingClash(clashId);

  const closed = await prisma.timetableClash.updateMany({
    where: { id: clash.id, status: TimetableClashStatus.PENDING },
    data: {
      status: TimetableClashStatus.DISMISSED,
      resolvedById: admin.id,
      resolvedAt: new Date(),
    },
  });
  if (closed.count !== 1) {
    throw new TimetableServiceError("CLASH_NOT_PENDING", "This clash has already been handled.");
  }

  const holder = clash.conflictingSlot?.classroom.title;
  const moving = clash.rescheduleSlot;
  if (moving) {
    await notifyTimeslotResolved({
      title: "Timetable request declined",
      teacherIds: [clash.requestedById],
      message: `Your request to move ${clash.classroom.title} (Section ${clash.classroom.section}) to ${formatSlot(clash.dayOfWeek, clash.startHour)} (Room ${clash.room}) was declined by the admin. ${holder ? `${holder} booked it first, so it keeps the slot.` : "That slot is not available."} ${clash.classroom.title} stays at ${slotLabelOf(moving)} in Room ${moving.room}.`,
    });
    return;
  }

  await notifyTimeslotResolved({
    title: "Timetable request declined",
    teacherIds: [clash.requestedById],
    message: `Your request for ${clash.classroom.title} (Section ${clash.classroom.section}) on ${formatSlot(clash.dayOfWeek, clash.startHour)} (Room ${clash.room}) was declined by the admin. ${holder ? `${holder} booked it first, so it keeps the slot.` : "The slot is not available."} No slot has been booked for ${clash.classroom.title} - please schedule it at another time.`,
  });
}
