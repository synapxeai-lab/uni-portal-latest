import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ClassroomStatus } from "@/generated/prisma/enums";

import { TimetableServiceError } from "../lib/errors";
import { ROOM_FORMAT_MESSAGE, isValidRoom } from "../lib/slots";

/**
 * Teaching rooms: the rows of the shared timetable and the only rooms teachers
 * can book. Numbers are three digits, the first one the floor (204 = floor 2).
 * A room is never renamed (bookings store its number); one booked by no class
 * can be deleted, and a room with no bookings can be taken out of use.
 */

export const createRoomSchema = z.object({
  number: z
    .string({ error: "Enter the room number." })
    .trim()
    .refine(isValidRoom, ROOM_FORMAT_MESSAGE),
});

export const roomStatusSchema = z.object({ isActive: z.boolean({ error: "Choose active or not." }) });

export interface RoomRow {
  id: string;
  number: string;
  floor: number;
  isActive: boolean;
  /** Classes booked in this room each week (active classes only). */
  weeklyClasses: number;
}

/** Bookings in a room, by number: active classes only (an archived class's slots don't count). */
async function bookingsByRoom(): Promise<Map<string, number>> {
  const rows = await prisma.timetableSlot.groupBy({
    by: ["room"],
    where: { classroom: { status: ClassroomStatus.ACTIVE } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.room, row._count._all]));
}

export async function listRooms(): Promise<RoomRow[]> {
  const [rooms, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: { number: "asc" } }),
    bookingsByRoom(),
  ]);
  return rooms.map((room) => ({
    id: room.id,
    number: room.number,
    floor: room.floor,
    isActive: room.isActive,
    weeklyClasses: bookings.get(room.number) ?? 0,
  }));
}

export async function createRoom(input: z.infer<typeof createRoomSchema>): Promise<RoomRow> {
  const number = input.number.trim();
  const existing = await prisma.room.findUnique({ where: { number } });
  if (existing) {
    throw new TimetableServiceError(
      "DUPLICATE",
      existing.isActive
        ? `Room ${number} already exists.`
        : `Room ${number} already exists but is out of use - reactivate it instead.`,
    );
  }
  const room = await prisma.room.create({ data: { number, floor: Number(number[0]) } });
  return { id: room.id, number: room.number, floor: room.floor, isActive: room.isActive, weeklyClasses: 0 };
}

async function findRoom(id: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    throw new TimetableServiceError("NOT_FOUND", "Room not found.");
  }
  return room;
}

/** Take a room out of use (only once no class is booked there) or back into use. */
export async function setRoomActive(id: string, isActive: boolean): Promise<void> {
  const room = await findRoom(id);
  if (!isActive) {
    const booked = (await bookingsByRoom()).get(room.number) ?? 0;
    if (booked > 0) {
      throw new TimetableServiceError(
        "VALIDATION_ERROR",
        `Room ${room.number} still has ${booked} class${booked === 1 ? "" : "es"} booked each week. Move ${booked === 1 ? "it" : "them"} to another room first.`,
      );
    }
  }
  await prisma.room.update({ where: { id }, data: { isActive } });
}

/** Delete a room that has never had a class booked (e.g. a typo). */
export async function deleteRoom(id: string): Promise<void> {
  const room = await findRoom(id);
  const everBooked = await prisma.timetableSlot.count({ where: { room: room.number } });
  if (everBooked > 0) {
    throw new TimetableServiceError(
      "VALIDATION_ERROR",
      `Room ${room.number} is on the timetable, so it can't be deleted. Take it out of use instead.`,
    );
  }
  await prisma.room.delete({ where: { id } });
}
