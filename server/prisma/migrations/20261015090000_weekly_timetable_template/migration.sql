-- The timetable becomes a weekly template: a slot is "weekday + hour", not a
-- calendar date. Existing rows keep their weekday (ISO: 1 = Monday .. 6 = Saturday).

-- TimetableSlot ---------------------------------------------------------------
ALTER TABLE "TimetableSlot" ADD COLUMN "dayOfWeek" INTEGER;
UPDATE "TimetableSlot" SET "dayOfWeek" = EXTRACT(ISODOW FROM "slotDate")::INTEGER;

-- Several dated slots can collapse onto the same weekday; keep the earliest
-- booking for each section / teacher / room and weekday+hour, drop the rest.
DELETE FROM "TimetableSlot" s USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "sectionKey", "dayOfWeek", "startHour" ORDER BY "createdAt", "id") AS rn
  FROM "TimetableSlot"
) d WHERE s."id" = d."id" AND d.rn > 1;
DELETE FROM "TimetableSlot" s USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "teacherId", "dayOfWeek", "startHour" ORDER BY "createdAt", "id") AS rn
  FROM "TimetableSlot"
) d WHERE s."id" = d."id" AND d.rn > 1;
DELETE FROM "TimetableSlot" s USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "roomKey", "dayOfWeek", "startHour" ORDER BY "createdAt", "id") AS rn
  FROM "TimetableSlot"
) d WHERE s."id" = d."id" AND d.rn > 1;

DROP INDEX IF EXISTS "TimetableSlot_sectionKey_slotDate_startHour_key";
DROP INDEX IF EXISTS "TimetableSlot_teacherId_slotDate_startHour_key";
DROP INDEX IF EXISTS "TimetableSlot_roomKey_slotDate_startHour_key";
DROP INDEX IF EXISTS "TimetableSlot_classroomId_slotDate_idx";
DROP INDEX IF EXISTS "TimetableSlot_slotDate_idx";

ALTER TABLE "TimetableSlot" DROP COLUMN "slotDate";
ALTER TABLE "TimetableSlot" ALTER COLUMN "dayOfWeek" SET NOT NULL;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 6);

CREATE UNIQUE INDEX "TimetableSlot_sectionKey_dayOfWeek_startHour_key" ON "TimetableSlot"("sectionKey", "dayOfWeek", "startHour");
CREATE UNIQUE INDEX "TimetableSlot_teacherId_dayOfWeek_startHour_key" ON "TimetableSlot"("teacherId", "dayOfWeek", "startHour");
CREATE UNIQUE INDEX "TimetableSlot_roomKey_dayOfWeek_startHour_key" ON "TimetableSlot"("roomKey", "dayOfWeek", "startHour");
CREATE INDEX "TimetableSlot_classroomId_dayOfWeek_idx" ON "TimetableSlot"("classroomId", "dayOfWeek");
CREATE INDEX "TimetableSlot_dayOfWeek_idx" ON "TimetableSlot"("dayOfWeek");

-- TimetableClash --------------------------------------------------------------
ALTER TABLE "TimetableClash" ADD COLUMN "dayOfWeek" INTEGER;
UPDATE "TimetableClash" SET "dayOfWeek" = LEAST(EXTRACT(ISODOW FROM "slotDate")::INTEGER, 6);
ALTER TABLE "TimetableClash" DROP COLUMN "slotDate";
ALTER TABLE "TimetableClash" ALTER COLUMN "dayOfWeek" SET NOT NULL;
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 6);
