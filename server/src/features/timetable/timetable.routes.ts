import { Router } from "express";

import { parseParams } from "@/http/validate";
import { TimetableServiceError } from "@/features/timetable/lib/errors";
import { currentUser, requireAdmin, requireRole } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateTimetable } from "@/lib/cache/tags";
import { UserRole } from "@/generated/prisma/enums";

import * as timetableService from "./services/timetable-service";
import {
  availabilitySchema,
  clashAvailabilitySchema,
  dismissClashSchema,
  rescheduleSlotSchema,
  resolveClashSchema,
  scheduleSlotSchema,
  slotIdSchema,
} from "./validation/timetable-schema";

export const timetableRouter = Router();

const requireTeacher = requireRole(UserRole.TEACHER);
const requireTeacherOrAdmin = requireRole(UserRole.TEACHER, UserRole.ADMIN);

const timetableTags = [CacheTags.TIMETABLE, CacheTags.ACADEMIC, CacheTags.AGGREGATES];

function getActiveRooms() {
  return cached("rooms:active", { ttl: CacheTtl.CLASSROOM, tags: [CacheTags.TIMETABLE] }, () =>
    timetableService.listActiveRooms(),
  );
}

/** Validation failures read like the old actions: the first issue's message. */
function parseOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } },
  fallback: string,
): T {
  if (!result.success) {
    throw new TimetableServiceError(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? fallback,
    );
  }
  return result.data;
}

/** Weekly timetable page: slots, plus what a teacher can schedule and the room list. */
timetableRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const isTeacher = user.role === UserRole.TEACHER;

  const [slots, schedulableClassrooms, rooms] = await Promise.all([
    cached(
      `timetable:${user.id}:${user.role}`,
      { ttl: CacheTtl.CLASSROOM, tags: timetableTags },
      () => timetableService.listWeeklyTimetable(user),
    ),
    isTeacher
      ? cached(`schedulable:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags: timetableTags }, () =>
          timetableService.listSchedulableClassrooms(user),
        )
      : Promise.resolve([]),
    isTeacher || user.role === UserRole.ADMIN ? getActiveRooms() : Promise.resolve([]),
  ]);

  res.json({ slots, schedulableClassrooms, rooms });
});

/** Which hours of a day are free for a class (teacher scheduling / rescheduling). */
timetableRouter.get("/availability", requireTeacherOrAdmin, async (req, res) => {
  const input = parseOrThrow(
    availabilitySchema.safeParse({
      classroomId: req.query.classroomId,
      dayOfWeek: Number(req.query.dayOfWeek),
      excludeSlotId: req.query.excludeSlotId || undefined,
      room: req.query.room || undefined,
    }),
    "Invalid request.",
  );
  const hours = await timetableService.getSlotAvailability(currentUser(req), input);
  res.set("Cache-Control", "no-store").json({ status: "success", data: hours });
});

timetableRouter.post("/slots", requireTeacher, async (req, res) => {
  const input = parseOrThrow(scheduleSlotSchema.safeParse(req.body), "Invalid slot.");
  const outcome = await timetableService.scheduleSlot(currentUser(req), input);
  invalidateTimetable();
  res.status(201).json({ status: "success", data: outcome });
});

timetableRouter.patch("/slots/:slotId", requireTeacherOrAdmin, async (req, res) => {
  const input = parseOrThrow(
    rescheduleSlotSchema.safeParse({ ...req.body, slotId: req.params.slotId }),
    "Invalid slot.",
  );
  const outcome = await timetableService.rescheduleSlot(currentUser(req), input);
  invalidateTimetable();
  res.json({ status: "success", data: outcome });
});

timetableRouter.delete("/slots/:slotId", requireTeacherOrAdmin, async (req, res) => {
  const { slotId } = parseParams(slotIdSchema, req.params, "Invalid slot.");
  await timetableService.cancelSlot(currentUser(req), slotId);
  invalidateTimetable();
  res.json({ status: "success", data: undefined });
});

// ---- Admin: clash resolution ----------------------------------------------------------

/** Admin "Timetable clashes" page: pending (default) or all clashes, plus the room list. */
timetableRouter.get("/clashes", requireAdmin, async (req, res) => {
  const filter = req.query.status === "all" ? "all" : "pending";
  const [clashes, rooms] = await Promise.all([
    cached(
      `clashes:${filter}`,
      { ttl: CacheTtl.LIVE, tags: [CacheTags.TIMETABLE, CacheTags.ADMIN] },
      () => timetableService.listClashes(filter),
    ),
    getActiveRooms(),
  ]);
  res.json({ clashes, rooms });
});

timetableRouter.get("/clashes/:clashId/availability", requireAdmin, async (req, res) => {
  const input = parseOrThrow(
    clashAvailabilitySchema.safeParse({
      clashId: req.params.clashId,
      dayOfWeek: Number(req.query.dayOfWeek),
      room: req.query.room || undefined,
    }),
    "Invalid request.",
  );
  const hours = await timetableService.getClashAvailability(
    input.clashId,
    input.dayOfWeek,
    input.room,
  );
  res.set("Cache-Control", "no-store").json({ status: "success", data: hours });
});

timetableRouter.post("/clashes/:clashId/resolve", requireAdmin, async (req, res) => {
  const input = parseOrThrow(
    resolveClashSchema.safeParse({ ...req.body, clashId: req.params.clashId }),
    "Invalid request.",
  );
  await timetableService.resolveClash(currentUser(req), input);
  invalidateTimetable();
  res.json({ status: "success", data: undefined });
});

timetableRouter.post("/clashes/:clashId/dismiss", requireAdmin, async (req, res) => {
  const { clashId } = parseParams(dismissClashSchema, req.params, "Invalid clash.");
  await timetableService.dismissClash(currentUser(req), clashId);
  invalidateTimetable();
  res.json({ status: "success", data: undefined });
});
