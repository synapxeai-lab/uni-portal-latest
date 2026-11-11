-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_CLASH_REPORTED';

-- CreateEnum
CREATE TYPE "TimetableClashKind" AS ENUM ('SECTION', 'ROOM');

-- AlterTable
ALTER TABLE "TimetableClash" ADD COLUMN "kind" "TimetableClashKind" NOT NULL DEFAULT 'SECTION';
