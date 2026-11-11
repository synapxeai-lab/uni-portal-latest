/**
 * Demo data for the unified portal.
 *
 *   docker compose exec server npm run seed
 *
 * Additive and idempotent: every row is upserted on a natural key (email,
 * code, name...), so the seed can run on top of the data imported from the two
 * legacy apps (npm run db:import-legacy) and re-run any number of times without
 * duplicating or wiping anything. Each module adds its own step.
 */
import { prisma } from "@/lib/prisma";

import { seedAccounts } from "./seed/accounts";
import { seedAcademics } from "./seed/academics";
import { seedPlatform } from "./seed/platform";
import { seedPeople } from "./seed/people";

async function main() {
  await seedPlatform(prisma);
  const accounts = await seedAccounts(prisma);
  console.log(`Accounts: ${accounts.length}`);
  const academics = await seedAcademics(prisma);
  console.log(`Programme ${academics.programme}: ${academics.diplomaIds.length} diplomas`);
  const people = await seedPeople(prisma);
  console.log(`People: ${people.teachers} teachers, ${people.students} students`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
