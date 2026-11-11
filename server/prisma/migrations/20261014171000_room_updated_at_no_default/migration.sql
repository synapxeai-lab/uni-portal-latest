-- Match Prisma's @updatedAt (no database default).
ALTER TABLE "Room" ALTER COLUMN "updatedAt" DROP DEFAULT;
