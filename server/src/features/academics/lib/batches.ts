import { prisma } from "@/lib/prisma";

/**
 * Batches are shared by every diploma: one fixed batch per intake year from
 * FIRST_BATCH onwards (named after its year), plus any an admin adds (the
 * Batch table) with their own name and intake year. Intakes begin in Fall, so
 * the next year's batch opens on 1 September. Mirrored in the client's
 * features/academics/lib/batches.ts.
 */
export const FIRST_BATCH = 2026;
const INTAKE_MONTH = 8; // September (0-based)

/** Sections every diploma starts with in a new batch. */
export const DEFAULT_SECTION_LABELS = ["A", "B"];

export interface BatchDetail {
  name: string;
  year: number | null;
}

function latestBatchYear(now = new Date()): number {
  return now.getMonth() >= INTAKE_MONTH ? now.getFullYear() : now.getFullYear() - 1;
}

/** The fixed yearly batches, newest first, e.g. ["2027", "2026"]. */
export function getYearlyBatches(now = new Date()): string[] {
  const batches: string[] = [];
  for (let year = latestBatchYear(now); year >= FIRST_BATCH; year -= 1) {
    batches.push(String(year));
  }
  return batches;
}

/** Rows saved before batches had a year fall back to a year-like name. */
export function yearFromName(name: string): number | null {
  const year = Number.parseInt(name, 10);
  return Number.isNaN(year) ? null : year;
}

/** Every batch, fixed and admin-added, minus any the admin deleted. Newest first. */
export async function getBatchDetails(): Promise<BatchDetail[]> {
  const rows = await prisma.batch.findMany({ select: { name: true, year: true, removed: true } });
  const byName = new Map<string, BatchDetail>(
    getYearlyBatches().map((name) => [name, { name, year: Number(name) }]),
  );
  for (const row of rows) {
    if (row.removed) {
      byName.delete(row.name);
    } else {
      byName.set(row.name, { name: row.name, year: row.year ?? yearFromName(row.name) });
    }
  }
  return [...byName.values()].sort(
    (a, b) =>
      (b.year ?? -Infinity) - (a.year ?? -Infinity) ||
      b.name.localeCompare(a.name, undefined, { numeric: true }),
  );
}

export async function getAllBatches(): Promise<string[]> {
  return (await getBatchDetails()).map((batch) => batch.name);
}

/** Batch name -> intake year, for semester calculations. */
export async function getBatchYears(): Promise<Map<string, number | null>> {
  return new Map((await getBatchDetails()).map((batch) => [batch.name, batch.year]));
}

export async function isValidBatch(batch: string): Promise<boolean> {
  return (await getAllBatches()).includes(batch);
}
