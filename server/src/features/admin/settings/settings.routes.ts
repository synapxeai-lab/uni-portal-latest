import { Router } from "express";

import { parseInput } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { invalidateSettings } from "@/lib/cache/tags";

import * as settingsService from "./services/settings-service";
import { updateSettingsSchema } from "./validation/settings-schema";

/** Platform settings - mounted under /admin (admin-only). */
export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  res.json(await settingsService.getSystemSettings());
});

settingsRouter.put("/", async (req, res) => {
  const input = parseInput(updateSettingsSchema, req.body);
  const settings = await settingsService.updateSystemSettings(input, currentUser(req));
  invalidateSettings();
  res.json({ status: "success", data: settings });
});
