import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

import { cached } from "./cache/tagged-cache";
import { CacheTags, CacheTtl } from "./cache/tags";

// A fixed, well-known id so the service layer always reads/writes the same
// singleton row rather than ever risking a second settings row being created.
export const SYSTEM_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

async function loadSystemSettings() {
  const existing = await prisma.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.systemSettings.create({ data: { id: SYSTEM_SETTINGS_ID } });
  } catch (error) {
    // Two concurrent first-reads can both miss the row and race to create it -
    // whichever loses just re-reads the row the winner created.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.systemSettings.findUniqueOrThrow({ where: { id: SYSTEM_SETTINGS_ID } });
    }
    throw error;
  }
}

/**
 * The platform's single settings row, created with defaults on first access.
 * Read by the session endpoint, login and many mutations, yet it only changes
 * when an admin saves Settings (which invalidates CacheTags.SETTINGS) - so it
 * is served from memory.
 */
export function getSystemSettings() {
  return cached("system-settings", { ttl: CacheTtl.SETTINGS, tags: [CacheTags.SETTINGS] }, () =>
    loadSystemSettings(),
  );
}

export type SystemSettings = Awaited<ReturnType<typeof loadSystemSettings>>;
