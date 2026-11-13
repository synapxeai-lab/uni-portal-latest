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
import { seedFutureStudent } from "./seed/future-student";
import { seedOfferings } from "./seed/offerings";
import { seedRegistration } from "./seed/registration";
import { seedAttendance } from "./seed/attendance";
import { seedMarks } from "./seed/marks";

async function main() {
  await seedPlatform(prisma);
  const accounts = await seedAccounts(prisma);
  console.log(`Accounts: ${accounts.length}`);
  const academics = await seedAcademics(prisma);
  console.log(`Programme ${academics.programme}: ${academics.diplomaIds.length} diplomas`);
  const people = await seedPeople(prisma);
  console.log(`People: ${people.teachers} teachers, ${people.students} students`);
  const future = await seedFutureStudent(prisma);
  console.log(`Not-started intake: ${future.email} in batch ${future.batch}`);
  const offerings = await seedOfferings(prisma);
  console.log(`Offerings: ${offerings.classrooms} classrooms`);
  const registration = await seedRegistration(prisma);
  console.log(`Registration ${registration.registration}: ${registration.enrolled} enrollments`);
  console.log(`Attendance: ${await seedAttendance(prisma)} records`);
  console.log(`Marks: ${await seedMarks(prisma)} entered`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
