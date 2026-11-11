import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { isValidBatch } from "../lib/batches";
import { notFoundError } from "../lib/http";
import { badRequest } from "@/http/errors";
import { syncStudentsForNewSection } from "../lib/section-sync";
import { archiveOfferingsWhere } from "../lib/offering-classrooms";

export const createSectionSchema = z.object({
  departmentId: z.number().int("Diploma is required"),
  batch: z.string().min(1, "Batch is required").refine(isValidBatch, { message: "Select a valid batch" }),
});

const include = {
  department: true,
  students: {
    orderBy: { name: "asc" },
    select: { id: true, name: true, rollNo: true, email: true, phone: true, batch: true, section: true },
  },
  courseLinks: {
    include: {
      course: true,
      teacher: { select: { id: true, name: true, email: true, phone: true } },
      classroom: { select: { id: true, code: true, status: true } },
    },
    orderBy: { course: { code: "asc" } },
  },
} satisfies Prisma.SectionInclude;

export async function getSection(id: number) {
  const section = await prisma.section.findUnique({ where: { id }, include });
  if (!section) {
    throw notFoundError("Section not found.");
  }
  return section;
}

/** Adds the next free lettered section (A-Z) to a diploma's batch. */
export async function createSection(input: z.infer<typeof createSectionSchema>) {
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) {
    throw notFoundError("Diploma not found.");
  }
  const existing = await prisma.section.findMany({
    where: { departmentId: input.departmentId, batch: input.batch },
    select: { label: true },
  });
  const taken = new Set(existing.map((section) => section.label));
  const label = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).find(
    (candidate) => !taken.has(candidate),
  );
  if (!label) {
    throw badRequest("Maximum number of sections (26) reached for this batch.");
  }
  const section = await prisma.section.create({
    data: { departmentId: input.departmentId, batch: input.batch, label },
  });
  // Students whose diploma/batch/section already match are linked right away.
  await syncStudentsForNewSection(section);
  return getSection(section.id);
}

export async function deleteSection(id: number) {
  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    throw notFoundError("Section not found.");
  }
  await archiveOfferingsWhere({ sectionId: id });
  await prisma.section.delete({ where: { id } });
  return section;
}
