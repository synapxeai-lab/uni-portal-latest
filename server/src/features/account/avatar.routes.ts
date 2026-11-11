import { Router } from "express";
import { z } from "zod";

import { notFound } from "@/http/errors";
import { REPLACEABLE_IMAGE_CACHE_CONTROL, sendStoredFile } from "@/http/stored-file";
import { parseParams } from "@/http/validate";
import { prisma } from "@/lib/prisma";
import { getImageMimeType } from "@/lib/storage/image-mime";

export const avatarRouter = Router();

/**
 * A self-uploaded avatar. Avatars show up in rosters, comments and admin
 * tables to any signed-in user who can see that person elsewhere, so being
 * signed in is the only requirement (enforced by requireAuth upstream).
 */
avatarRouter.get("/:userId", async (req, res) => {
  const { userId } = parseParams(
    z.object({ userId: z.string().uuid() }),
    req.params,
    "Invalid user id.",
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageKey: true },
  });
  if (!user?.avatarStorageKey) {
    throw notFound("No avatar.");
  }

  await sendStoredFile(req, res, {
    storageKey: user.avatarStorageKey,
    contentType: getImageMimeType(user.avatarStorageKey),
    cacheControl: REPLACEABLE_IMAGE_CACHE_CONTROL,
  });
});
