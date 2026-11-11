-- AlterTable
ALTER TABLE "TimetableClash" ADD COLUMN "rescheduleSlotId" UUID;

-- CreateIndex
CREATE INDEX "TimetableClash_rescheduleSlotId_status_idx" ON "TimetableClash"("rescheduleSlotId", "status");

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_rescheduleSlotId_fkey" FOREIGN KEY ("rescheduleSlotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
