/*
  Warnings:

  - Made the column `section` on table `Classroom` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TimetableClashStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_CLASH';
ALTER TYPE "NotificationType" ADD VALUE 'TIMESLOT_RESOLVED';

-- Backfill: section is now mandatory, so any pre-existing classroom without one
-- gets a placeholder. Teachers must set a real section (via Edit class) before
-- they can schedule timetable slots for it.
UPDATE "Classroom" SET "section" = 'Unassigned' WHERE "section" IS NULL OR btrim("section") = '';

-- AlterTable
ALTER TABLE "Classroom" ALTER COLUMN "section" SET NOT NULL;

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "slotDate" DATE NOT NULL,
    "startHour" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableClash" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "conflictingSlotId" UUID,
    "sectionKey" TEXT NOT NULL,
    "slotDate" DATE NOT NULL,
    "startHour" INTEGER NOT NULL,
    "status" "TimetableClashStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" UUID,
    "resolvedSlotId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableClash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableSlot_classroomId_slotDate_idx" ON "TimetableSlot"("classroomId", "slotDate");

-- CreateIndex
CREATE INDEX "TimetableSlot_slotDate_idx" ON "TimetableSlot"("slotDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_sectionKey_slotDate_startHour_key" ON "TimetableSlot"("sectionKey", "slotDate", "startHour");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_teacherId_slotDate_startHour_key" ON "TimetableSlot"("teacherId", "slotDate", "startHour");

-- CreateIndex
CREATE INDEX "TimetableClash_status_createdAt_idx" ON "TimetableClash"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TimetableClash_classroomId_status_idx" ON "TimetableClash"("classroomId", "status");

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_conflictingSlotId_fkey" FOREIGN KEY ("conflictingSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_resolvedSlotId_fkey" FOREIGN KEY ("resolvedSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Slots are 1 hour long, 08:00-17:00 (start hours 8..16).
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_startHour_check" CHECK ("startHour" BETWEEN 8 AND 16);
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_startHour_check" CHECK ("startHour" BETWEEN 8 AND 16);
