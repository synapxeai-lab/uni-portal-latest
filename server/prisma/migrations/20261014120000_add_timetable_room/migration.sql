-- Each timetable slot / clash now records the room the class meets in.
-- Existing rows (none expected - the feature is new) get a unique placeholder
-- room so the new per-room uniqueness constraint can be created.
ALTER TABLE "TimetableSlot" ADD COLUMN "room" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TimetableSlot" ADD COLUMN "roomKey" TEXT NOT NULL DEFAULT '';
UPDATE "TimetableSlot" SET "room" = 'Unassigned', "roomKey" = 'legacy-' || "id";
ALTER TABLE "TimetableSlot" ALTER COLUMN "room" DROP DEFAULT;
ALTER TABLE "TimetableSlot" ALTER COLUMN "roomKey" DROP DEFAULT;

ALTER TABLE "TimetableClash" ADD COLUMN "room" TEXT NOT NULL DEFAULT 'Unassigned';
ALTER TABLE "TimetableClash" ALTER COLUMN "room" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_roomKey_slotDate_startHour_key" ON "TimetableSlot"("roomKey", "slotDate", "startHour");
