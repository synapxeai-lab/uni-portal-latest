-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE 'RESTORED';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE';
