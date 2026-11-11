import type { PrismaClient } from "@/generated/prisma/client";

/** The fixed id of the singleton settings row (see lib/system-settings.ts). */
export const SYSTEM_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

// Teaching rooms: three digits, the first is the floor.
const ROOMS = [
  "101", "104", "107", "110", "112",
  "201", "203", "206", "209", "211",
  "302", "305", "308", "310",
  "404", "407",
];

export async function seedPlatform(prisma: PrismaClient) {
  await prisma.systemSettings.upsert({
    where: { id: SYSTEM_SETTINGS_ID },
    update: {},
    create: { id: SYSTEM_SETTINGS_ID, academicYear: "2026-2027" },
  });

  await prisma.room.createMany({
    data: ROOMS.map((number) => ({ number, floor: Number(number[0]) })),
    skipDuplicates: true,
  });
}
