-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "assignmentId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_assignmentId_key" ON "Assessment"("assignmentId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

