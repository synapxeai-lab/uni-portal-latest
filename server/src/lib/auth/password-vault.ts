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

function key(): Buffer {
  return crypto
    .createHash("sha256")
    .update(env.PASSWORD_ENC_KEY ?? env.JWT_SECRET)
    .digest();
}

/** "iv.tag.ciphertext", each base64 - the same format the University Portal stored. */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

/** null when the value is missing or can't be decrypted with the current key. */
export function decryptPassword(stored: string | null | undefined): string | null {
  if (!stored) {
    return null;
  }
  try {
    const [iv, tag, data] = stored.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
