/**
 * Makes every password the admin can view readable with this server's key:
 *
 * 1. Copies encrypted with an old key (PASSWORD_ENC_OLD_KEYS, e.g. after the
 *    database was copied from another server) are re-encrypted with the
 *    current key, so the old key can be removed afterwards.
 * 2. Accounts with no readable copy at all (passwords set before they became
 *    viewable) get one when you pass their password: each candidate is checked
 *    against the account's hash, and only a match is stored. A hash can't be
 *    reversed, so passwords nobody knows have to be reset on the Users page.
 *
 * Nobody's password or sign-in changes.
 *
 *   npx tsx scripts/backfill-viewable-passwords.ts ["<known password>" ...]
 *   (production image, no tsx: node dist/backfill-viewable-passwords.js ...)
 */
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { decryptPasswordWithKeyInfo, encryptPassword } from "@/lib/auth/password-vault";

const candidates = process.argv.slice(2);

const users = await prisma.user.findMany({
  where: { passwordHash: { not: null } },
  select: { id: true, email: true, passwordHash: true, passwordEnc: true },
});

let rekeyed = 0;
let restored = 0;
const unmatched: string[] = [];

for (const user of users) {
  const copy = decryptPasswordWithKeyInfo(user.passwordEnc);
  if (copy) {
    if (copy.oldKey) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordEnc: encryptPassword(copy.password) } });
      rekeyed += 1;
    }
    continue;
  }

  let match: string | undefined;
  for (const candidate of candidates) {
    if (await verifyPassword(candidate, user.passwordHash!)) {
      match = candidate;
      break;
    }
  }
  if (match === undefined) {
    unmatched.push(user.email);
    continue;
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordEnc: encryptPassword(match) } });
  restored += 1;
  console.log(`restored: ${user.email}`);
}

for (const email of unmatched) {
  console.log(`still not viewable (reset it on the Users page): ${email}`);
}
console.log(
  `${rekeyed} re-encrypted with the current key, ${restored} restored from known passwords, ` +
    `${unmatched.length} still not viewable, ${users.length} accounts in all.`,
);
await prisma.$disconnect();
