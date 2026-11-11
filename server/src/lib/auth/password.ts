import bcrypt from "bcryptjs";

import { encryptPassword } from "./password-vault";

const SALT_ROUNDS = 10;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * The bcrypt hash plus the admin-viewable encrypted copy, ready to spread into
 * a User create/update. Every place that sets a password goes through this so
 * the two never drift apart.
 */
export async function passwordFields(plainPassword: string) {
  return {
    passwordHash: await hashPassword(plainPassword),
    passwordEnc: encryptPassword(plainPassword),
  };
}
