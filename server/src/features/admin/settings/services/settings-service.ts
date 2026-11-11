import type { SessionUser } from "@/auth/session";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, SYSTEM_SETTINGS_ID, type SystemSettings } from "@/lib/system-settings";

import type { UpdateSettingsInput } from "../validation/settings-schema";

export { getSystemSettings };
export type { SystemSettings };

export async function updateSystemSettings(
  input: UpdateSettingsInput,
  actor: SessionUser,
): Promise<SystemSettings> {
  // Ensures the singleton row exists (first-ever save) before updating it.
  await getSystemSettings();

  return prisma.systemSettings.update({
    where: { id: SYSTEM_SETTINGS_ID },
    data: { ...input, updatedById: actor.id },
  });
}
