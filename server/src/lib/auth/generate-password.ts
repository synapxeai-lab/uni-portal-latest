import crypto from "crypto";

// Excludes visually ambiguous characters (0/O, 1/l/I) so a temporary password
// read off-screen and typed by hand is less error-prone.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

export function generateTemporaryPassword(length = 7): string {
  const bytes = crypto.randomBytes(length);
  let password = "";

  for (let index = 0; index < length; index += 1) {
    password += CHARSET[bytes[index] % CHARSET.length];
  }

  return password;
}
