-- REVIEWED now means graded. A REVIEWED row without a grade is still waiting to be graded.
UPDATE "Submission" s SET "status" = CASE
    WHEN a."dueDate" IS NOT NULL AND s."submittedAt" > a."dueDate" THEN 'LATE'::"SubmissionStatus"
    ELSE 'SUBMITTED'::"SubmissionStatus"
  END
FROM "Assignment" a
WHERE a.id = s."assignmentId" AND s."status" = 'REVIEWED' AND s."grade" IS NULL;
