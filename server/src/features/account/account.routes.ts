import { Router } from "express";

import { changePasswordSchema } from "@portal/shared/auth";

import { badRequest, notFound } from "@/http/errors";
import { multipart } from "@/http/upload";
import { currentUser } from "@/middleware/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateAdmin, invalidateAllAcademic, invalidateUser } from "@/lib/cache/tags";
import { deleteUserAvatar, uploadUserAvatar } from "@/lib/storage/avatar-service";
import { extractUploadedFiles } from "@/lib/storage/extract-files";
import { getPasswordPolicyViolations } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/system-settings";
import { UserStatus } from "@/generated/prisma/enums";

export const accountRouter = Router();

/** Profile page: the account as set up by an administrator. */
accountRouter.get("/profile", async (req, res) => {
  const profile = await prisma.user.findUnique({
    where: { id: currentUser(req).id },
    select: { name: true, email: true, role: true, avatarUrl: true, createdAt: true },
  });
  if (!profile) {
    throw notFound("Account not found.");
  }
  res.set("Cache-Control", "no-store").json(profile);
});

/** Replace the profile photo (the only self-editable profile field). */
accountRouter.post("/avatar", multipart, async (req, res) => {
  const user = currentUser(req);
  const file = extractUploadedFiles(req, "avatar")[0];
  if (!file) {
    throw badRequest("Choose a photo to upload.");
  }

  const key = await uploadUserAvatar(file, user.id);
  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarStorageKey: true },
  });

  // avatarUrl becomes the stable serving route rather than the raw storage
  // key, so every place that renders `avatarUrl` as an <img src> just works.
  await prisma.user.update({
    where: { id: user.id },
    // ?v= changes with every upload so browsers never show a cached old photo.
    data: { avatarUrl: `/api/avatars/${user.id}?v=${Date.now()}`, avatarStorageKey: key },
  });

  // Best-effort cleanup of the replaced file - never fails the update.
  if (previous?.avatarStorageKey) {
    await deleteUserAvatar(previous.avatarStorageKey).catch(() => {});
  }

  // The photo shows up in every roster, comment and the session.
  invalidateUser(user.id);
  invalidateAllAcademic();
  res.json({ status: "success", data: undefined });
});

const FIX_FIELDS = "Please fix the highlighted fields.";

accountRouter.post("/password", async (req, res) => {
  const user = currentUser(req);

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(FIX_FIELDS, parsed.error.flatten().fieldErrors);
  }

  // The admin-forced reset skips the current-password check - the admin
  // already authenticated that reset out-of-band. It only counts as forced
  // when the account really has a pending forced change; otherwise every
  // self-service change must prove the user still knows their password.
  const forced = req.mustChangePassword === true;
  if (!forced) {
    const currentPassword = parsed.data.currentPassword ?? "";
    if (!currentPassword) {
      throw badRequest(FIX_FIELDS, { currentPassword: ["Current password is required."] });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    const isCurrentPasswordValid =
      dbUser?.passwordHash != null && (await verifyPassword(currentPassword, dbUser.passwordHash));
    if (!isCurrentPasswordValid) {
      throw badRequest(FIX_FIELDS, { currentPassword: ["Current password is incorrect."] });
    }
  }

  const settings = await getSystemSettings();
  // Uppercase and symbol requirements are intentionally not enforced here;
  // only the configured minimum length and number requirement apply.
  const violations = getPasswordPolicyViolations(parsed.data.newPassword, {
    ...settings,
    requirePasswordUppercase: false,
    requirePasswordSymbol: false,
  });
  if (violations.length > 0) {
    throw badRequest(FIX_FIELDS, { newPassword: violations });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  // Clears any admin-forced change and reactivates an account that was
  // pending one.
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, status: UserStatus.ACTIVE },
  });

  invalidateUser(user.id);
  invalidateAdmin();

  res.json({ status: "success", data: undefined });
});
