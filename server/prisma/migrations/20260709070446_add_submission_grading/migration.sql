-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "gradedAt" TIMESTAMP(3);
