import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { conflictError, notFoundError } from "../lib/http";
import { ensureDefaultCategories } from "../lib/programme-categories";

// Icon: the first whose keywords appear in the name, else a graduation cap.
// Names match PROGRAMME_ICONS in the client's features/academics/lib/programme-icons.ts.
const ICON_KEYWORDS: [string, RegExp][] = [
  ["chef-hat", /culinary|cook|chef|kitchen/],
  ["cake", /bak|pastr|patisserie|confection|cake/],
  ["coffee", /barista|coffee|cafe/],
  ["wine", /wine|bar\b|beverage|mixolog/],
  ["utensils", /food|restaurant|catering|dining/],
  ["concierge-bell", /hospitality|front office|housekeeping|guest|cpd/],
  ["hotel", /hotel|resort|lodging/],
  ["briefcase", /business|management|tourism|travel|event/],
  ["palette", /art|design|decor/],
  ["book-open", /language|english|study|academic/],
];

function pickIcon(label: string): string {
  const name = label.toLowerCase();
  return ICON_KEYWORDS.find(([, pattern]) => pattern.test(name))?.[0] ?? "graduation-cap";
}

/** Colour pairs, shared with the diploma colours on the client. */
export const COLOURS = [
  { color: "#b45309", bg: "#fef3c7" },
  { color: "#be185d", bg: "#fce7f3" },
  { color: "#1565c0", bg: "#e8f1fd" },
  { color: "#0f766e", bg: "#ccfbf1" },
  { color: "#6b21a8", bg: "#f3e8ff" },
  { color: "#b91c1c", bg: "#fef2f2" },
  { color: "#166534", bg: "#dcfce7" },
  { color: "#92400e", bg: "#ffedd5" },
  { color: "#44403c", bg: "#f5f5f4" },
];

function pickColour(existing: { color: string }[]) {
  const used = new Set(existing.map((category) => category.color));
  return COLOURS.find((pair) => !used.has(pair.color)) ?? COLOURS[existing.length % COLOURS.length];
}

const fields = {
  label: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  description: z.string().trim().min(1, "Description is required"),
};
export const createProgrammeSchema = z.object(fields);
export const updateProgrammeSchema = z.object(fields).partial();

// "Bakery & Pastry Programmes" -> "BAKERY_PASTRY" (key) / "bakery-pastry" (slug).
function baseName(label: string): string {
  return (
    label
      .replace(/\s+programmes?$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() || "programme"
  );
}

async function uniqueValue(field: "key" | "slug", base: string): Promise<string> {
  for (let n = 1; ; n += 1) {
    const value = n === 1 ? base : `${base}${field === "key" ? "_" : "-"}${n}`;
    const taken = await prisma.programmeCategory.count({ where: { [field]: value } });
    if (!taken) {
      return value;
    }
  }
}

async function assertLabelFree(label: string, exceptId?: number) {
  const clash = await prisma.programmeCategory.findFirst({
    where: { label: { equals: label, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) {
    throw conflictError("A main programme with this name already exists.");
  }
}

export async function createProgramme(input: z.infer<typeof createProgrammeSchema>) {
  await ensureDefaultCategories();
  await assertLabelFree(input.label);
  const base = baseName(input.label);
  const existing = await prisma.programmeCategory.findMany({ select: { color: true, position: true } });
  return prisma.programmeCategory.create({
    data: {
      ...input,
      icon: pickIcon(input.label),
      ...pickColour(existing),
      key: await uniqueValue("key", base.toUpperCase().replace(/ /g, "_")),
      slug: await uniqueValue("slug", base.replace(/ /g, "-")),
      position: Math.max(-1, ...existing.map((category) => category.position)) + 1,
    },
  });
}

/** The key and slug never change, so records and links that use them keep working. */
export async function updateProgramme(id: number, input: z.infer<typeof updateProgrammeSchema>) {
  const target = await prisma.programmeCategory.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Main programme not found.");
  }
  if (input.label) {
    await assertLabelFree(input.label, id);
  }
  return prisma.programmeCategory.update({ where: { id }, data: input });
}

/** Only an unused programme can be deleted. */
export async function deleteProgramme(id: number) {
  const target = await prisma.programmeCategory.findUnique({ where: { id } });
  if (!target) {
    throw notFoundError("Main programme not found.");
  }
  const [departments, teachers, students] = await Promise.all([
    prisma.department.count({ where: { category: target.key } }),
    prisma.teacher.count({ where: { programme: target.key } }),
    prisma.student.count({ where: { programme: target.key } }),
  ]);
  const inUse = [
    departments && `${departments} diploma(s)`,
    teachers && `${teachers} teacher(s)`,
    students && `${students} student(s)`,
  ].filter(Boolean);
  if (inUse.length) {
    throw conflictError(`${target.label} still has ${inUse.join(", ")}. Move or delete them first.`);
  }
  await prisma.programmeCategory.delete({ where: { id } });
}
