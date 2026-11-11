import { Router, type Request } from "express";
import { z } from "zod";

import { notFound } from "@/http/errors";
import { multipart } from "@/http/upload";
import { parseInput, parseParams } from "@/http/validate";
import { currentUser } from "@/middleware/auth";
import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateAssignment, invalidateClassroom } from "@/lib/cache/tags";
import { extractUploadedFiles } from "@/lib/storage/extract-files";
import type { SessionUser } from "@/auth/session";
import { AssignmentStatus, MaterialStatus } from "@/generated/prisma/enums";
import { requireVisibleClassroom } from "@/features/classroom/classroom.routes";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";

import * as assignmentService from "./services/assignment-service";
import * as materialService from "./services/material-service";
import * as topicService from "./services/topic-service";
import type { AssignmentSummary } from "./types";
import {
  assignmentIdSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from "./validation/assignment-schema";
import {
  createMaterialSchema,
  materialIdSchema,
  updateMaterialSchema,
} from "./validation/material-schema";
import {
  createTopicSchema,
  renameTopicSchema,
  reorderTopicsSchema,
  topicIdSchema,
} from "./validation/topic-schema";

/** Mounted at /classrooms/:classroomId. */
export const classworkRouter = Router({ mergeParams: true });

const ASSIGNMENT_STATUS = {
  DRAFT: AssignmentStatus.DRAFT,
  SCHEDULED: AssignmentStatus.SCHEDULED,
  PUBLISHED: AssignmentStatus.PUBLISHED,
} as const;

const MATERIAL_STATUS = {
  DRAFT: MaterialStatus.DRAFT,
  SCHEDULED: MaterialStatus.SCHEDULED,
  PUBLISHED: MaterialStatus.PUBLISHED,
} as const;

function classroomIdOf(req: Request): string {
  return parseParams(
    z.object({ classroomId: z.string().uuid() }),
    req.params,
    "Invalid classroom id.",
  ).classroomId;
}

function attachmentIdOf(req: Request): string {
  return parseParams(
    z.object({ fileAttachmentId: z.string().uuid() }),
    req.params,
    "Invalid attachment.",
  ).fileAttachmentId;
}

// ---- Cached reads (per viewer, tagged by classroom) ---------------------------

function classroomTags(classroomId: string) {
  return [CacheTags.ACADEMIC, CacheTags.classroom(classroomId)];
}

export function getCachedTopics(classroomId: string, user: SessionUser) {
  return cached(
    `topics:${classroomId}:${user.id}`,
    { ttl: CacheTtl.CLASSROOM, tags: classroomTags(classroomId) },
    () => topicService.listClassroomTopics(classroomId, user),
  );
}

export async function getCachedAssignment(
  classroomId: string,
  assignmentId: string,
  user: SessionUser,
): Promise<AssignmentSummary> {
  try {
    return await cached(
      `assignment:${assignmentId}:${user.id}`,
      {
        ttl: CacheTtl.CLASSROOM,
        tags: [...classroomTags(classroomId), CacheTags.assignment(assignmentId)],
      },
      () => assignmentService.getAssignmentForUser(classroomId, assignmentId, user),
    );
  } catch (error) {
    if (
      error instanceof ClassroomServiceError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      throw notFound("Assignment not found.");
    }
    throw error;
  }
}

/** Everything the Classwork tab renders, in one round trip. */
classworkRouter.get("/classwork", async (req, res) => {
  const user = currentUser(req);
  const classroomId = classroomIdOf(req);
  await requireVisibleClassroom(classroomId, user);
  const tags = classroomTags(classroomId);

  const [topics, materials, assignments] = await Promise.all([
    getCachedTopics(classroomId, user),
    cached(`materials:${classroomId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
      materialService.listClassroomMaterials(classroomId, user),
    ),
    cached(`assignments:${classroomId}:${user.id}`, { ttl: CacheTtl.CLASSROOM, tags }, () =>
      assignmentService.listClassroomAssignments(classroomId, user),
    ),
  ]);

  res.json({ topics, materials, assignments });
});

/** Assignment detail page: the assignment plus the topics its edit dialog offers. */
classworkRouter.get("/assignments/:assignmentId", async (req, res) => {
  const user = currentUser(req);
  const classroomId = classroomIdOf(req);
  const { assignmentId } = parseParams(assignmentIdSchema, req.params, "Invalid assignment.");
  await requireVisibleClassroom(classroomId, user);

  const [assignment, topics] = await Promise.all([
    getCachedAssignment(classroomId, assignmentId, user),
    getCachedTopics(classroomId, user),
  ]);
  res.json({ assignment, topics });
});

// ---- Topics -------------------------------------------------------------------

classworkRouter.post("/topics", async (req, res) => {
  const input = parseInput(createTopicSchema, { ...req.body, classroomId: classroomIdOf(req) });
  const topic = await topicService.createTopic(input.classroomId, currentUser(req), input.title);
  invalidateClassroom(input.classroomId);
  res.status(201).json({ status: "success", data: topic });
});

classworkRouter.put("/topics/order", async (req, res) => {
  const input = parseParams(
    reorderTopicsSchema,
    { classroomId: classroomIdOf(req), orderedTopicIds: req.body?.orderedTopicIds },
    "Invalid topic order.",
  );
  await topicService.reorderTopics(input.classroomId, currentUser(req), input.orderedTopicIds);
  invalidateClassroom(input.classroomId);
  res.json({ status: "success", data: undefined });
});

classworkRouter.patch("/topics/:topicId", async (req, res) => {
  const input = parseInput(renameTopicSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
    topicId: req.params.topicId,
  });
  const topic = await topicService.renameTopic(input.topicId, currentUser(req), input.title);
  invalidateClassroom(input.classroomId);
  res.json({ status: "success", data: topic });
});

classworkRouter.delete("/topics/:topicId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { topicId } = parseParams(topicIdSchema, req.params, "Invalid topic.");
  await topicService.deleteTopic(topicId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

// ---- Materials ------------------------------------------------------------------

classworkRouter.post("/materials", multipart, async (req, res) => {
  const input = parseInput(createMaterialSchema, { ...req.body, classroomId: classroomIdOf(req) });
  const material = await materialService.createMaterial(
    input.classroomId,
    currentUser(req),
    { title: input.title, description: input.description, url: input.url, topicId: input.topicId },
    extractUploadedFiles(req),
    MATERIAL_STATUS[input.status],
    input.scheduledFor ? new Date(input.scheduledFor) : null,
  );
  invalidateClassroom(input.classroomId);
  res.status(201).json({ status: "success", data: material });
});

classworkRouter.patch("/materials/:materialId", multipart, async (req, res) => {
  const input = parseInput(updateMaterialSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
    materialId: req.params.materialId,
  });
  const material = await materialService.updateMaterial(
    input.materialId,
    currentUser(req),
    { title: input.title, description: input.description, url: input.url, topicId: input.topicId },
    extractUploadedFiles(req),
  );
  invalidateClassroom(input.classroomId);
  res.json({ status: "success", data: material });
});

classworkRouter.delete("/materials/:materialId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { materialId } = parseParams(materialIdSchema, req.params, "Invalid material.");
  await materialService.deleteMaterial(materialId, currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

classworkRouter.delete("/materials/:materialId/attachments/:fileAttachmentId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { materialId } = parseParams(materialIdSchema, req.params, "Invalid material.");
  await materialService.removeMaterialAttachment(materialId, attachmentIdOf(req), currentUser(req));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

// ---- Assignments ------------------------------------------------------------------

classworkRouter.post("/assignments", multipart, async (req, res) => {
  const input = parseInput(createAssignmentSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
  });
  const assignment = await assignmentService.createAssignment(
    input.classroomId,
    currentUser(req),
    {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      points: input.points,
      allowLateSubmission: input.allowLateSubmission,
      topicId: input.topicId,
    },
    ASSIGNMENT_STATUS[input.status],
    extractUploadedFiles(req),
    input.scheduledFor ? new Date(input.scheduledFor) : null,
  );
  invalidateClassroom(input.classroomId);
  res.status(201).json({ status: "success", data: assignment });
});

classworkRouter.patch("/assignments/:assignmentId", multipart, async (req, res) => {
  const input = parseInput(updateAssignmentSchema, {
    ...req.body,
    classroomId: classroomIdOf(req),
    assignmentId: req.params.assignmentId,
  });
  const assignment = await assignmentService.updateAssignment(
    input.assignmentId,
    currentUser(req),
    {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      points: input.points,
      allowLateSubmission: input.allowLateSubmission,
      topicId: input.topicId,
    },
    extractUploadedFiles(req),
  );
  invalidateAssignment(input.classroomId, input.assignmentId);
  res.json({ status: "success", data: assignment });
});

classworkRouter.post("/assignments/:assignmentId/close", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { assignmentId } = parseParams(assignmentIdSchema, req.params, "Invalid assignment.");
  await assignmentService.closeAssignment(assignmentId, currentUser(req));
  invalidateAssignment(classroomId, assignmentId);
  res.json({ status: "success", data: undefined });
});

classworkRouter.delete("/assignments/:assignmentId", async (req, res) => {
  const classroomId = classroomIdOf(req);
  const { assignmentId } = parseParams(assignmentIdSchema, req.params, "Invalid assignment.");
  await assignmentService.deleteAssignment(assignmentId, currentUser(req));
  invalidateAssignment(classroomId, assignmentId);
  res.json({ status: "success", data: undefined });
});

classworkRouter.delete(
  "/assignments/:assignmentId/attachments/:fileAttachmentId",
  async (req, res) => {
    const classroomId = classroomIdOf(req);
    const { assignmentId } = parseParams(assignmentIdSchema, req.params, "Invalid assignment.");
    await assignmentService.removeAssignmentAttachment(
      assignmentId,
      attachmentIdOf(req),
      currentUser(req),
    );
    invalidateAssignment(classroomId, assignmentId);
    res.json({ status: "success", data: undefined });
  },
);
