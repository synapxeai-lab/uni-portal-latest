import type { Section } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { DEFAULT_SECTION_LABELS } from "./batches";

/**
 * `Student.section` is the label typed on the student form; it doesn't by
 * itself put the student in a real Section. A student moves through every
 * diploma of their programme, so they belong to one section per diploma of
 * their batch. This keeps those links in step: it drops links outside their
 * programme/batch and, for each diploma they have no section in yet, connects
 * the one whose label matches theirs.
 */
export async function syncEnrolledSection(studentId: number): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { enrolledSections: { include: { department: true } } },
  });
  if (!student) {
    return;
  }

  const inScope = (section: (typeof student.enrolledSections)[number]) =>
    section.department.category === student.programme && section.batch === student.batch;
  const stale = student.enrolledSections.filter((section) => !inScope(section));
  const covered = new Set(student.enrolledSections.filter(inScope).map((s) => s.departmentId));

  const matches = await prisma.section.findMany({
    where: {
      batch: student.batch,
      label: { equals: student.section, mode: "insensitive" },
      department: { category: student.programme },
    },
  });
  const missing = matches.filter((section) => !covered.has(section.departmentId));

  if (stale.length || missing.length) {
    await prisma.student.update({
      where: { id: studentId },
      data: {
        enrolledSections: {
          ...(stale.length ? { disconnect: stale.map((s) => ({ id: s.id })) } : {}),
          ...(missing.length ? { connect: missing.map((s) => ({ id: s.id })) } : {}),
        },
      },
    });
  }
}

/** When a section is created, link the existing students whose programme/batch/label match it. */
export async function syncStudentsForNewSection(section: Section): Promise<void> {
  const department = await prisma.department.findUnique({ where: { id: section.departmentId } });
  if (!department) {
    return;
  }
  const candidates = await prisma.student.findMany({
    where: {
      programme: department.category,
      batch: section.batch,
      section: { equals: section.label, mode: "insensitive" },
    },
    select: { id: true },
  });
  for (const { id } of candidates) {
    await syncEnrolledSection(id);
  }
}

/**
 * Makes sure every given diploma has the default Sections A and B in every
 * given batch; only missing ones are created. Returns how many were created.
 */
export async function ensureDefaultSections(departmentIds: number[], batches: string[]): Promise<number> {
  const wanted = departmentIds.flatMap((departmentId) =>
    batches.flatMap((batch) => DEFAULT_SECTION_LABELS.map((label) => ({ departmentId, batch, label }))),
  );
  if (wanted.length === 0) {
    return 0;
  }
  const existing = await prisma.section.findMany({
    where: {
      departmentId: { in: departmentIds },
      batch: { in: batches },
      label: { in: DEFAULT_SECTION_LABELS },
    },
    select: { departmentId: true, batch: true, label: true },
  });
  const key = (s: { departmentId: number; batch: string; label: string }) =>
    `${s.departmentId}|${s.batch}|${s.label}`;
  const have = new Set(existing.map(key));
  const missing = wanted.filter((section) => !have.has(key(section)));
  for (const data of missing) {
    await syncStudentsForNewSection(await prisma.section.create({ data }));
  }
  return missing.length;
}
