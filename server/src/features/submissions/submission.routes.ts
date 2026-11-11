import { Router, type Request } from "express";

import { badRequest, notFound } from "@/http/errors";
import { multipart } from "@/http/upload";
import { parseInput, parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateAssignment } from "@/lib/cache/tags";
import { extractUploadedFiles } from "@/lib/storage/extract-files";
import type { SessionUser } from "@/auth/session";
import { requireVisibleClassroom } from "@/features/classroom/classroom.routes";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import { getCachedAssignment } from "@/features/classwork/classwork.routes";

import * as submissionService from "./services/submission-service";
import {
  classroomAssignmentIdSchema,
  deletePrivateCommentSchema,
  gradeInputSchema,
  privateCommentSchema,
  removeAttachmentSchema,
  studentSubmissionIdSchema,
  submissionMutationSchema,
} from "./validation/submission-schema";

/** Mounted at /classrooms/:classroomId/assignments/:assignmentId. */
export const submissionRouter = Router({ mergeParams: true });

function idsOf(req: Request) {
  return parseParams(classroomAssignmentIdSchema, req.params, "Invalid assignment.");
}

function studentIdsOf(req: Request) {
  return parseParams(studentSubmissionIdSchema, req.params, "Invalid submission.");
}

function assignmentTags(classroomId: string, assignmentId: string) {
  return [CacheTags.ACADEMIC, CacheTags.classroom(classroomId), CacheTags.assignment(assignmentId)];
}

/** "Not found" and "not yours" read the same, like the old notFound() pages. */
async function orNotFound<T>(load: () => Promise<T>, message: string): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof ClassroomServiceError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      throw notFound(message);
    }
    throw error;
  }
}

/** The assignment, only when the viewer manages it (teacher-only pages). */
async function requireManagedAssignment(
  classroomId: string,
  assignmentId: string,
  user: SessionUser,
) {
  await requireVisibleClassroom(classroomId, user);
  const assignment = await getCachedAssignment(classroomId, assignmentId, user);
  if (!assignment.canManage) {
    throw notFound("Assignment not found.");
  }
  return assignment;
}

// ---- Reads ------------------------------------------------------------------------

/**
 * The assignment page's right-hand column in one round trip: the teacher's
 * submission overview and grade summary, or the student's own submission
 * and private comments.
 */
submissionRouter.get("/submission-panel", async (req, res) => {
  const user = currentUser(req);
  const { classroomId, assignmentId } = idsOf(req);
  await requireVisibleClassroom(classroomId, user);
  const assignment = await getCachedAssignment(classroomId, assignmentId, user);
  const tags = assignmentTags(classroomId, assignmentId);

  if (assignment.canManage) {
    const [overview, gradeSummary] = await orNotFound(
      () =>
        Promise.all([
          cached(`submissions:${assignmentId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
            submissionService.getAssignmentSubmissions(classroomId, assignmentId, user),
          ),
          cached(
            `grade-summary:${assignmentId}:${user.id}`,
            { ttl: CacheTtl.CLASSROOM, tags },
            () => submissionService.getAssignmentGradeSummary(classroomId, assignmentId, user),
          ),
        ]),
      "Assignment not found.",
    );
    res.json({ kind: "teacher", overview, gradeSummary });
    return;
  }

  const [view, comments] = await Promise.all([
    cached(`own-submission:${assignmentId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
      submissionService.getSubmissionForStudent(assignmentId, user),
    ),
    cached(`own-comments:${assignmentId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
      submissionService.getOwnSubmissionComments(assignmentId, user),
    ),
  ]);
  res.json({ kind: "student", view, comments });
});

/** Teacher's submissions list. */
submissionRouter.get("/submissions", async (req, res) => {
  const user = currentUser(req);
  const { classroomId, assignmentId } = idsOf(req);
  const assignment = await requireManagedAssignment(classroomId, assignmentId, user);
  const overview = await orNotFound(
    () =>
      cached(
        `submissions:${assignmentId}:${user.id}`,
        { ttl: CacheTtl.CLASSROOM, tags: assignmentTags(classroomId, assignmentId) },
        () => submissionService.getAssignmentSubmissions(classroomId, assignmentId, user),
      ),
    "Assignment not found.",
  );
  res.json({ assignment, overview });
});

/** Teacher's review of one student's submission. */
submissionRouter.get("/submissions/:studentId", async (req, res) => {
  const user = currentUser(req);
  const { classroomId, assignmentId, studentId } = studentIdsOf(req);
  const assignment = await requireManagedAssignment(classroomId, assignmentId, user);
  const detail = await orNotFound(
    () =>
      cached(
        `submission:${assignmentId}:${studentId}:${user.id}`,
        { ttl: CacheTtl.CLASSROOM, tags: assignmentTags(classroomId, assignmentId) },
        () => submissionService.getSubmissionDetails(classroomId, assignmentId, studentId, user),
      ),
    "Submission not found.",
  );
  res.json({ assignment, detail });
});

// ---- Student: own submission ----------------------------------------------------------

submissionRouter.post("/submission/draft", multipart, async (req, res) => {
  const input = parseInput(submissionMutationSchema, { ...req.body, ...idsOf(req) });
  const view = await submissionService.createOrUpdateSubmission(
    input.assignmentId,
    currentUser(req),
    { textAnswer: input.textAnswer },
    extractUploadedFiles(req),
  );
  invalidateAssignment(input.classroomId, input.assignmentId);
  res.json({ status: "success", data: view });
});

submissionRouter.post("/submission/submit", multipart, async (req, res) => {
  const input = parseInput(submissionMutationSchema, { ...req.body, ...idsOf(req) });
  const view = await submissionService.submitSubmission(
    input.assignmentId,
    currentUser(req),
    { textAnswer: input.textAnswer },
    extractUploadedFiles(req),
  );
  invalidateAssignment(input.classroomId, input.assignmentId);
  res.json({ status: "success", data: view });
});

submissionRouter.post("/submission/unsubmit", async (req, res) => {
  const { classroomId, assignmentId } = idsOf(req);
  const view = await submissionService.unsubmitSubmission(assignmentId, currentUser(req));
  invalidateAssignment(classroomId, assignmentId);
  res.json({ status: "success", data: view });
});

submissionRouter.delete(
  "/submission/:submissionId/attachments/:fileAttachmentId",
  async (req, res) => {
    const { classroomId, assignmentId } = idsOf(req);
    const { submissionId, fileAttachmentId } = parseParams(
      removeAttachmentSchema,
      req.params,
      "Invalid attachment.",
    );
    await submissionService.removeSubmissionAttachment(
      submissionId,
      fileAttachmentId,
      currentUser(req),
    );
    invalidateAssignment(classroomId, assignmentId);
    res.json({ status: "success", data: undefined });
  },
);

// ---- Private comments (student <-> teacher) ---------------------------------------------

submissionRouter.post("/submissions/:studentId/comments", async (req, res) => {
  const parsed = privateCommentSchema.safeParse({
    ...studentIdsOf(req),
    content: req.body?.content,
  });
  if (!parsed.success) {
    throw badRequest(
      "Please write a comment first.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const { classroomId, assignmentId, studentId, content } = parsed.data;
  const comment = await submissionService.createPrivateComment(
    classroomId,
    assignmentId,
    studentId,
    currentUser(req),
    content,
  );
  invalidateAssignment(classroomId, assignmentId);
  res.status(201).json({ status: "success", data: comment });
});

submissionRouter.delete("/submissions/:studentId/comments/:commentId", async (req, res) => {
  const { classroomId, assignmentId, commentId } = parseParams(
    deletePrivateCommentSchema,
    req.params,
    "Invalid comment.",
  );
  await submissionService.deletePrivateComment(commentId, currentUser(req));
  invalidateAssignment(classroomId, assignmentId);
  res.json({ status: "success", data: undefined });
});

// ---- Teacher: grading -------------------------------------------------------------------

submissionRouter.post("/submissions/:studentId/return", async (req, res) => {
  const { classroomId, assignmentId, studentId } = studentIdsOf(req);
  const detail = await submissionService.returnSubmission(
    classroomId,
    assignmentId,
    studentId,
    currentUser(req),
  );
  invalidateAssignment(classroomId, assignmentId);
  res.json({ status: "success", data: detail });
});

submissionRouter.put("/submissions/:studentId/grade", async (req, res) => {
  const input = parseInput(gradeInputSchema, {
    ...studentIdsOf(req),
    grade: req.body?.grade,
    feedback: req.body?.feedback,
  });
  const detail = await submissionService.setSubmissionGrade(
    input.classroomId,
    input.assignmentId,
    input.studentId,
    currentUser(req),
    { grade: input.grade, feedback: input.feedback },
  );
  invalidateAssignment(input.classroomId, input.assignmentId);
  res.json({ status: "success", data: detail });
});
