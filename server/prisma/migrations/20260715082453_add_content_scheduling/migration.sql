-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- AlterEnum
ALTER TYPE "AnnouncementStatus" ADD VALUE 'SCHEDULED';

-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" UUID,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" UUID,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" UUID,
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "status" "MaterialStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Assignment_status_scheduledFor_idx" ON "Assignment"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Material_status_scheduledFor_idx" ON "Material"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
