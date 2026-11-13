import { z } from "zod";

import { prisma } from "@/lib/prisma";

import type { Prisma } from "@/generated/prisma/client";

import { FIRST_BATCH, getBatchDetails, getYearlyBatches, type BatchDetail } from "../lib/batches";
import { conflictError, notFoundError } from "../lib/http";
import { ensureDefaultSections } from "../lib/section-sync";
import { archiveOfferingsWhere } from "../lib/offering-classrooms";

/**
 * The app already shows "Batch" before a batch's name, so a leading "Batch"
 * typed by the admin is dropped ("Batch 2026" is batch "2026"), and repeated
 * spaces collapse.
 */
const cleanBatchName = (name: string) => name.trim().replace(/^batch(?:[\s-]+|$)/i, "").replace(/\s+/g, " ").trim();

/** Two names are the same batch when they match ignoring case, spaces and hyphens ("Spring-27" = "spring 27"). */
const batchKey = (name: string) => cleanBatchName(name).toLowerCase().replace(/[\s-]+/g, "");

function findSameBatch(existing: string[], name: string, except?: string) {
  return existing.find((batch) => batch !== except && batchKey(batch) === batchKey(name));
}

/** Each intake year has at most one batch, fixed or added. */
function assertYearFree(existing: BatchDetail[], year: number, except?: string) {
  const taken = existing.find((batch) => batch.name !== except && batch.year === year);
  if (taken) {
    throw conflictError(`The ${year} intake already has batch ${taken.name}. Each intake year can have only one batch.`);
  }
}

type Tx = Prisma.TransactionClient;

/**
 * A batch added for an intake year whose fixed batch hasn't appeared yet (it
 * appears on 1 September) takes that year: the fixed batch is marked removed
 * so the year never ends up with two batches.
 */
async function claimYear(tx: Tx, name: string, year: number) {
  const fixed = String(year);
  if (year < FIRST_BATCH || name === fixed || getYearlyBatches().includes(fixed)) {
    return;
  }
  await tx.batch.upsert({ where: { name: fixed }, update: { removed: true }, create: { name: fixed, year, removed: true } });
}

/** Undoes claimYear when a batch leaves a future intake year, so its fixed batch can appear again. */
async function releaseYear(tx: Tx, year: number | null) {
  if (year === null || getYearlyBatches().includes(String(year))) {
    return;
  }
  await tx.batch.deleteMany({ where: { name: String(year), removed: true } });
}

export const batchSchema = z
  .object({
    name: z
      .string()
      .transform(cleanBatchName)
      .pipe(
        z
          .string()
          .min(1, "Batch name is required")
          .max(20, "Batch name must be at most 20 characters")
          .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Use letters, numbers, spaces or hyphens only"),
      ),
    year: z.coerce
      .number({ error: "Batch year is required" })
      .int("Batch year must be a whole year")
      .min(2000, "Enter a valid year")
      .max(2100, "Enter a valid year"),
  })
  // A name that is itself a year would clash with that year's fixed batch.
  .refine(({ name, year }) => !/^\d{4}$/.test(name) || Number(name) === year, {
    message: "A batch named after a year must use that year",
    path: ["name"],
  });

type BatchInput = z.infer<typeof batchSchema>;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Adds a batch; every diploma gets Sections A and B in it. */
export async function createBatch({ name, year }: BatchInput) {
  const details = await getBatchDetails();
  const same = findSameBatch(
    details.map((batch) => batch.name),
    name,
  );
  if (same) {
    throw conflictError(`Batch ${same} already exists.`);
  }
  assertYearFree(details, year);
  await prisma.$transaction(async (tx) => {
    await claimYear(tx, name, year);
    // Re-adding a batch that was deleted earlier brings it back.
    await tx.batch.upsert({ where: { name }, update: { year, removed: false }, create: { name, year } });
  });
  const departments = await prisma.department.findMany({ select: { id: true } });
  await ensureDefaultSections(
    departments.map((department) => department.id),
    [name],
  );
  return {
    batch: { name, year },
    message: `Batch ${name} (${year} intake) added with Sections A and B in ${plural(departments.length, "diploma")}.`,
  };
}

/**
 * Renames and/or re-dates a batch. A rename moves its sections, students and
 * credit-limit overrides to the new name; a new year changes its students'
 * semester and so their current diploma.
 */
export async function updateBatch(oldName: string, { name, year }: BatchInput) {
  const details = await getBatchDetails();
  const current = details.find((batch) => batch.name === oldName);
  if (!current) {
    throw notFoundError("Batch not found.");
  }
  const renamed = name !== oldName;
  const same = renamed
    ? findSameBatch(
        details.map((batch) => batch.name),
        name,
        oldName,
      )
    : undefined;
  if (same) {
    throw conflictError(`Batch ${same} already exists.`);
  }
  assertYearFree(details, year, oldName);
  await prisma.$transaction(async (tx) => {
    if (current.year !== year) {
      await releaseYear(tx, current.year);
    }
    await claimYear(tx, name, year);
    if (renamed) {
      await tx.section.updateMany({ where: { batch: oldName }, data: { batch: name } });
      await tx.student.updateMany({ where: { batch: oldName }, data: { batch: name } });
      await tx.registrationLimit.updateMany({ where: { batch: oldName }, data: { batch: name } });
      // A yearly batch would come back under its old name, so hide it; an
      // added batch's old row can simply go.
      if (getYearlyBatches().includes(oldName)) {
        await tx.batch.upsert({
          where: { name: oldName },
          update: { removed: true },
          create: { name: oldName, year: Number(oldName), removed: true },
        });
      } else {
        await tx.batch.deleteMany({ where: { name: oldName } });
      }
    }
    await tx.batch.upsert({ where: { name }, update: { year, removed: false }, create: { name, year } });
  });
  return {
    batch: { name, year },
    message: renamed
      ? `Batch ${oldName} renamed to ${name} (${year} intake).`
      : `Batch ${name} updated (${year} intake).`,
  };
}

/** Removes a batch and its sections; refused while any student is still in it. */
export async function deleteBatch(name: string) {
  const target = (await getBatchDetails()).find((batch) => batch.name === name);
  if (!target) {
    throw notFoundError("Batch not found.");
  }
  const studentCount = await prisma.student.count({ where: { batch: name } });
  if (studentCount > 0) {
    throw conflictError(
      `Batch ${name} still has ${plural(studentCount, "student")}. Move or remove them before deleting the batch.`,
    );
  }
  await archiveOfferingsWhere({ section: { batch: name } });
  const { count } = await prisma.$transaction(async (tx) => {
    const deleted = await tx.section.deleteMany({ where: { batch: name } });
    if (getYearlyBatches().includes(name)) {
      await tx.batch.upsert({
        where: { name },
        update: { removed: true },
        create: { name, year: Number(name), removed: true },
      });
    } else {
      await tx.batch.deleteMany({ where: { name } });
      await releaseYear(tx, target.year);
    }
    return deleted;
  });
  return {
    message: `Batch ${name} deleted${count ? ` along with ${plural(count, "section")}` : ""}.`,
  };
}
