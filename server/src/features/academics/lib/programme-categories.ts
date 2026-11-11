import { z } from "zod";

import { prisma } from "@/lib/prisma";

/**
 * The main programmes EITHM started with. They're created the first time the
 * table is read while empty, so data that already uses these keys works.
 */
export const DEFAULT_CATEGORIES = [
  {
    key: "CULINARY",
    slug: "culinary",
    label: "Culinary Programmes",
    icon: "chef-hat",
    description: "CTH (UK) diplomas in professional cookery, patisserie and confectionery.",
    color: "#b45309",
    bg: "#fef3c7",
    position: 0,
  },
  {
    key: "CPD",
    slug: "cpd",
    label: "CPD Programmes",
    icon: "concierge-bell",
    description:
      "CTH (UK) awards and certificates in hospitality, front office, housekeeping, food & beverage service and barista skills.",
    color: "#1565c0",
    bg: "#e8f1fd",
    position: 1,
  },
];

let defaultsReady: Promise<void> | null = null;

export function ensureDefaultCategories(): Promise<void> {
  defaultsReady ??= (async () => {
    if (await prisma.programmeCategory.count()) {
      return;
    }
    await prisma.programmeCategory.createMany({ data: DEFAULT_CATEGORIES, skipDuplicates: true });
  })().catch((error) => {
    defaultsReady = null;
    throw error;
  });
  return defaultsReady;
}

export async function listCategories() {
  await ensureDefaultCategories();
  return prisma.programmeCategory.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
}

export async function categoryExists(key: string): Promise<boolean> {
  await ensureDefaultCategories();
  return (await prisma.programmeCategory.count({ where: { key } })) > 0;
}

/** A zod field for a programme key that must exist. Async - use parseInputAsync. */
export function categoryKeyField(message = "Programme is required") {
  return z
    .string({ error: message })
    .min(1, message)
    .refine(categoryExists, { message: "Pick a valid programme" });
}
