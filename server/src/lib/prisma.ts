import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

// One pooled client for the whole process. The pool is sized for a single
// API instance; every request's queries run in parallel where possible.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 20 });

export const prisma = new PrismaClient({ adapter });
