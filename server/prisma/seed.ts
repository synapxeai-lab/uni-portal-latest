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
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { seedAccounts } from "./seed/accounts";
import { seedPlatform } from "./seed/platform";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await seedPlatform(prisma);
  const accounts = await seedAccounts(prisma);
  console.log(`Seeded ${accounts.length} accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
