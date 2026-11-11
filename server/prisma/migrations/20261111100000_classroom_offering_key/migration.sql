-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "offeringKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_offeringKey_key" ON "Classroom"("offeringKey");

