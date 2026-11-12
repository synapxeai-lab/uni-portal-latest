-- Grading is now final and "returned" means "returned for revision".
-- Work that was returned with a grade (the old "graded and returned") is graded work now.
UPDATE "Submission" SET "status" = 'REVIEWED' WHERE "status" = 'RETURNED' AND "grade" IS NOT NULL;
-- Graded work: gradedAt is when the grade was given (it was only set on return before).
UPDATE "Submission" SET "gradedAt" = COALESCE("gradedAt", "updatedAt") WHERE "status" = 'REVIEWED' AND "grade" IS NOT NULL;
