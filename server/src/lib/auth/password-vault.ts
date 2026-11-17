import crypto from "node:crypto";

import { env } from "@/config/env";

/**
 * Reversible copy of each user's current password, so admins can look it up
 * and hand it to a student or teacher (the University Portal's Users page).
 * Sign-in never uses this - it checks the bcrypt hash - so a missing or
 * undecryptable copy only means the admin has to reset the password to see it.
 *
 * Key: PASSWORD_ENC_KEY, falling back to JWT_SECRET. Changing the key makes the
 * stored copies unreadable, never the logins.
 */
const ALGORITHM = "aes-256-gcm";

const derive = (secret: string) => crypto.createHash("sha256").update(secret).digest();

/** The key new copies are encrypted with. */
function key(): Buffer {
  return derive(env.PASSWORD_ENC_KEY ?? env.JWT_SECRET);
}

/**
 * Keys a stored copy may have been encrypted with: the current one, then
 * PASSWORD_ENC_OLD_KEYS (comma-separated) - e.g. the key of the server a
 * database was copied from, so its users' passwords stay viewable here.
 */
function decryptionKeys(): Buffer[] {
  const old = (env.PASSWORD_ENC_OLD_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return [key(), ...old.map(derive)];
}

/** "iv.tag.ciphertext", each base64 - the same format the University Portal stored. */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

/** null when the value is missing or can't be decrypted with any known key. */
export function decryptPassword(stored: string | null | undefined): string | null {
  return decryptPasswordWithKeyInfo(stored)?.password ?? null;
}

/** Like decryptPassword, plus whether it took an old key (so the copy should be re-encrypted). */
export function decryptPasswordWithKeyInfo(
  stored: string | null | undefined,
): { password: string; oldKey: boolean } | null {
  if (!stored) {
    return null;
  }
  const keys = decryptionKeys();
  for (const [index, candidate] of keys.entries()) {
    try {
      const [iv, tag, data] = stored.split(".").map((part) => Buffer.from(part, "base64"));
      const decipher = crypto.createDecipheriv(ALGORITHM, candidate, iv);
      decipher.setAuthTag(tag);
      const password = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
      return { password, oldKey: index > 0 };
    } catch {
      // Wrong key (the auth tag doesn't match) - try the next one.
    }
  }
  return null;
}
