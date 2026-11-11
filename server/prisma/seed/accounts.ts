import { passwordFields } from "@/lib/auth/password";
import { UserRole, UserStatus, type PrismaClient } from "@/generated/prisma/client";

export interface SeedAccount {
  key: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/**
 * Sign-in accounts for each role. Teachers and students also get academic
 * profiles from the people seed; these are just the logins.
 */
export const SEED_ACCOUNTS: SeedAccount[] = [
  { key: "admin", name: "Portal Administrator", email: "admin@eithm.edu.pk", password: "Admin@12345", role: UserRole.ADMIN },
  { key: "ayesha", name: "Dr. Ayesha Khan", email: "ayesha.khan@eithm.edu.pk", password: "Teacher@123", role: UserRole.TEACHER },
  { key: "bilal", name: "Mr. Bilal Ahmed", email: "bilal.ahmed@eithm.edu.pk", password: "Teacher@123", role: UserRole.TEACHER },
  { key: "sana", name: "Chef Sana Mirza", email: "sana.mirza@eithm.edu.pk", password: "Teacher@123", role: UserRole.TEACHER },
  { key: "ali", name: "Ali Raza", email: "ali.raza@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "maryam", name: "Maryam Iqbal", email: "maryam.iqbal@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "hassan", name: "Hassan Javed", email: "hassan.javed@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "zara", name: "Zara Sheikh", email: "zara.sheikh@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "omar", name: "Omar Farooq", email: "omar.farooq@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
  { key: "hina", name: "Hina Aslam", email: "hina.aslam@eithm.edu.pk", password: "Student@123", role: UserRole.STUDENT },
];

/** Upserts every seed account; returns their user ids by key. */
export async function seedAccounts(prisma: PrismaClient) {
  const results: { key: string; id: string }[] = [];
  for (const account of SEED_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    // An existing account keeps its password (someone may have changed it).
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          name: account.name,
          email: account.email,
          role: account.role,
          status: UserStatus.ACTIVE,
          ...(await passwordFields(account.password)),
        },
      }));
    results.push({ key: account.key, id: user.id });
  }
  return results;
}
