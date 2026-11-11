import { z } from "zod";

import { badRequest } from "@/http/errors";
import { prisma } from "@/lib/prisma";

import { isValidBatch } from "../lib/batches";
import { conflictError, notFoundError } from "../lib/http";
import { syncClassroomsFor } from "../lib/offering-classrooms";
import {
  computeRegistrationYear,
  endOfDay,
  openRegistrationWhere,
  SEMESTERS,
  startOfDay,
  type Semester,
} from "../lib/terms";

/** A batch registers under this cap unless an admin overrides it for the period. */
export const DEFAULT_CREDIT_LIMIT = 40;

const label = (semester: string) => semester.charAt(0) + semester.slice(1).toLowerCase();

const date = (message: string) => z.coerce.date({ error: message });
const periodFields = {
  semesterStart: date("A valid semester start date is required"),
  semesterEnd: date("A valid semester end date is required"),
};

export const startRegistrationSchema = z
  .object({
    semester: z.enum(SEMESTERS as [Semester, ...Semester[]], { error: "Semester must be Spring, Summer, or Fall" }),
    startDate: date("A valid start date is required"),
    endDate: date("A valid end date is required"),
    ...periodFields,
  })
  .refine((d) => d.endDate > d.startDate, { message: "End date must be after the start date", path: ["endDate"] })
  .refine((d) => d.semesterEnd > d.semesterStart, {
    message: "Semester end must be after the semester start",
    path: ["semesterEnd"],
  });

export const semesterPeriodSchema = z
  .object(periodFields)
  .refine((d) => d.semesterEnd > d.semesterStart, {
    message: "Semester end must be after the semester start",
    path: ["semesterEnd"],
  });

export const batchLimitSchema = z.object({
  batch: z.string().min(1, "Batch is required").refine(isValidBatch, { message: "Select a valid batch" }),
  creditLimit: z.number().int().min(1, "Credit limit must be at least 1").max(100, "Credit limit is too high"),
});

type RegistrationRow = { startDate: Date; endDate: Date; closedAt: Date | null };

/** ACTIVE inside [startDate, end of endDate], UPCOMING before, CLOSED after or once ended early. */
export function withRegistrationStatus<T extends RegistrationRow>(registration: T) {
  const now = new Date();
  let status: "UPCOMING" | "ACTIVE" | "CLOSED" = "UPCOMING";
  if (registration.closedAt || now > endOfDay(registration.endDate)) {
    status = "CLOSED";
  } else if (now >= registration.startDate) {
    status = "ACTIVE";
  }
  return { ...registration, status };
}

const include = {
  limits: { orderBy: { batch: "asc" as const } },
  _count: { select: { enrollments: true, challans: true } },
};

export async function listRegistrations() {
  const registrations = await prisma.registration.findMany({
    include,
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
  });
  return registrations.map(withRegistrationStatus);
}

/**
 * For every role's home page: the semester running now (its period covers
 * today, else the latest not yet ended) and the registration window to show
 * (the open one, else the latest).
 */
export async function currentPeriods() {
  const now = new Date();
  const latestFirst = [{ year: "desc" as const }, { startDate: "desc" as const }];
  const [running, unended, open, latest] = await Promise.all([
    prisma.registration.findFirst({
      where: { semesterStart: { lte: now }, semesterEnd: { gte: startOfDay(now) }, semesterEndedAt: null },
      orderBy: { semesterStart: "desc" },
    }),
    prisma.registration.findFirst({ where: { semesterEndedAt: null }, orderBy: latestFirst }),
    prisma.registration.findFirst({ where: openRegistrationWhere(now), orderBy: { startDate: "desc" } }),
    prisma.registration.findFirst({ orderBy: latestFirst }),
  ]);
  const semester = running ?? unended;
  const registration = open ?? latest;
  return {
    semester: semester && {
      semester: semester.semester,
      year: semester.year,
      semesterStart: semester.semesterStart,
      semesterEnd: semester.semesterEnd,
    },
    registration: registration && (() => {
      const { semester: s, year, startDate, endDate, closedAt, status } = withRegistrationStatus(registration);
      return { semester: s, year, startDate, endDate, closedAt, status };
    })(),
  };
}

async function assertNoOverlap(semesterStart: Date, semesterEnd: Date, exceptId?: number) {
  const other = await prisma.registration.findFirst({
    where: {
      ...(exceptId ? { id: { not: exceptId } } : {}),
      semesterEndedAt: null,
      semesterStart: { lte: semesterEnd },
      semesterEnd: { gte: semesterStart },
    },
  });
  if (other) {
    throw conflictError(`The semester period overlaps ${label(other.semester)} ${other.year}'s semester period.`);
  }
}

/** Opens registration; the year comes from the semester's window, not the client. */
export async function startRegistration(input: z.infer<typeof startRegistrationSchema>) {
  const year = computeRegistrationYear(input.semester);
  if (await prisma.registration.findUnique({ where: { semester_year: { semester: input.semester, year } } })) {
    throw conflictError(`A registration for ${label(input.semester)} ${year} already exists.`);
  }
  const unended = await prisma.registration.findFirst({
    where: { semesterEndedAt: null },
    orderBy: [{ year: "desc" }, { startDate: "desc" }],
  });
  if (unended) {
    throw conflictError(
      `The ${label(unended.semester)} ${unended.year} semester has not ended yet. End it before opening registration for the next semester.`,
    );
  }
  await assertNoOverlap(input.semesterStart, input.semesterEnd);
  const registration = await prisma.registration.create({ data: { ...input, year }, include });
  return withRegistrationStatus(registration);
}

async function findRegistration(id: number) {
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) {
    throw notFoundError("Registration not found.");
  }
  return registration;
}

/** Ends an active registration early; the original window is kept for the record. */
export async function endRegistration(id: number) {
  const existing = await findRegistration(id);
  if (withRegistrationStatus(existing).status !== "ACTIVE") {
    throw badRequest("Only an active registration can be ended.");
  }
  return withRegistrationStatus(
    await prisma.registration.update({ where: { id }, data: { closedAt: new Date() }, include }),
  );
}

/** Ends the semester (closing its registration too), so the next one can open. */
export async function endSemester(id: number) {
  const existing = await findRegistration(id);
  if (existing.semesterEndedAt) {
    throw badRequest("This semester has already ended.");
  }
  const now = new Date();
  return withRegistrationStatus(
    await prisma.registration.update({
      where: { id },
      data: { semesterEndedAt: now, closedAt: existing.closedAt ?? now },
      include,
    }),
  );
}

/**
 * Deletes a registration with its enrollments (attendance, marks), challans
 * and limits; refused once a challan is paid. Classroom rosters follow.
 */
export async function deleteRegistration(id: number) {
  const existing = await findRegistration(id);
  const paid = await prisma.challan.count({ where: { registrationId: id, status: "PAID" } });
  if (paid > 0) {
    throw badRequest(
      `${label(existing.semester)} ${existing.year} can't be deleted: ${paid} fee challan${paid === 1 ? " has" : "s have"} been paid.`,
    );
  }
  const pairs = await prisma.enrollment.findMany({
    where: { registrationId: id },
    select: { courseId: true, sectionId: true },
    distinct: ["courseId", "sectionId"],
  });
  await prisma.registration.delete({ where: { id } });
  await syncClassroomsFor(pairs);
  return existing;
}

export async function setSemesterPeriod(id: number, input: z.infer<typeof semesterPeriodSchema>) {
  await findRegistration(id);
  await assertNoOverlap(input.semesterStart, input.semesterEnd, id);
  return withRegistrationStatus(await prisma.registration.update({ where: { id }, data: input, include }));
}

export async function setBatchLimit(id: number, input: z.infer<typeof batchLimitSchema>) {
  await findRegistration(id);
  return prisma.registrationLimit.upsert({
    where: { registrationId_batch: { registrationId: id, batch: input.batch } },
    update: { creditLimit: input.creditLimit },
    create: { registrationId: id, ...input },
  });
}

export async function deleteBatchLimit(id: number, batch: string) {
  await findRegistration(id);
  await prisma.registrationLimit.deleteMany({ where: { registrationId: id, batch } });
}

export { label as semesterLabel };
