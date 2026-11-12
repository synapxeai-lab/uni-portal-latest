/**
 * Creates the first admin account on a fresh production database (or resets an
 * existing account's password and makes it an active admin). The seed is for
 * demo data and isn't in the production image; this is.
 *
 * Bundled to dist/create-admin.js. In the production container:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='Your Name' \
 *     node dist/create-admin.js
 */
import { passwordFields } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@/generated/prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Portal Administrator";

async function main() {
  if (!email || !email.includes("@")) {
    throw new Error("Set ADMIN_EMAIL to the admin's email address.");
  }
  if (!password || password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD to a password of at least 8 characters.");
  }

  const fields = await passwordFields(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...fields,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedAt: null,
      },
    });
    console.log(`Updated ${email}: active admin with the new password.`);
  } else {
    await prisma.user.create({
      data: { name, email, role: UserRole.ADMIN, status: UserStatus.ACTIVE, ...fields },
    });
    console.log(`Created admin ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
