-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "classroomId" UUID;

-- Backfill: existing stream notifications already link to /classes/<id>/stream.
UPDATE "Notification"
SET "classroomId" = substring("link" from '^/classes/([0-9a-f-]{36})/stream')::uuid
WHERE "type" IN ('NEW_ANNOUNCEMENT', 'CLASS_COMMENT')
  AND "link" ~ '^/classes/[0-9a-f-]{36}/stream'
  AND EXISTS (
    SELECT 1 FROM "Classroom"
    WHERE "Classroom"."id" = substring("Notification"."link" from '^/classes/([0-9a-f-]{36})/stream')::uuid
  );

-- CreateIndex
CREATE INDEX "Notification_recipientId_classroomId_isRead_idx" ON "Notification"("recipientId", "classroomId", "isRead");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
