-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" UUID NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'GCR',
    "academicYear" TEXT NOT NULL DEFAULT '2025-2026',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxUploadSizeMb" INTEGER NOT NULL DEFAULT 25,
    "defaultAllowComments" BOOLEAN NOT NULL DEFAULT true,
    "defaultAllowMaterials" BOOLEAN NOT NULL DEFAULT true,
    "defaultAllowAssignments" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewAssignment" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewMaterial" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewAnnouncement" BOOLEAN NOT NULL DEFAULT true,
    "notifySubmissionReturned" BOOLEAN NOT NULL DEFAULT true,
    "notifyPrivateComment" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
