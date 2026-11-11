import type { SessionUser } from "@/auth/session";
import {
  assertManagementAccess,
  hasManagementAccess,
} from "@/features/classroom/services/classroom-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import { prisma } from "@/lib/prisma";
import { ClassroomStatus } from "@/generated/prisma/enums";

import type { TopicSummary } from "../types";

function toTopicSummary(
  topic: { id: string; title: string; position: number },
  canManage: boolean,
): TopicSummary {
  return {
    id: topic.id,
    title: topic.title,
    position: topic.position,
    canManage,
  };
}

async function findActiveTopicOrThrow(topicId: string) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });

  if (!topic || topic.deletedAt) {
    throw new ClassroomServiceError("NOT_FOUND", "Topic not found.");
  }

  return topic;
}

// Shared with material-service/assignment-service - both let a teacher assign
// content to a topic, and must reject a topic id from a different classroom.
export async function assertTopicBelongsToClassroom(
  topicId: string,
  classroomId: string,
): Promise<void> {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });

  if (!topic || topic.deletedAt || topic.classroomId !== classroomId) {
    throw new ClassroomServiceError("NOT_FOUND", "Topic not found in this classroom.");
  }
}

export async function listClassroomTopics(
  classroomId: string,
  viewer: SessionUser,
): Promise<TopicSummary[]> {
  const [topics, canManage] = await Promise.all([
    prisma.topic.findMany({
      where: { classroomId, deletedAt: null },
      orderBy: { position: "asc" },
    }),
    hasManagementAccess(classroomId, viewer),
  ]);

  return topics.map((topic) => toTopicSummary(topic, canManage));
}

export async function createTopic(
  classroomId: string,
  user: SessionUser,
  title: string,
): Promise<TopicSummary> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  if (classroom.status === ClassroomStatus.ARCHIVED) {
    throw new ClassroomServiceError(
      "ARCHIVED",
      "This class is archived and can't accept new topics.",
    );
  }

  await assertManagementAccess(classroomId, user);

  const existingCount = await prisma.topic.count({ where: { classroomId, deletedAt: null } });

  const created = await prisma.topic.create({
    data: { classroomId, title, position: existingCount },
  });

  return toTopicSummary(created, true);
}

export async function renameTopic(
  topicId: string,
  user: SessionUser,
  title: string,
): Promise<TopicSummary> {
  const existing = await findActiveTopicOrThrow(topicId);
  await assertManagementAccess(existing.classroomId, user);

  const updated = await prisma.topic.update({ where: { id: topicId }, data: { title } });

  return toTopicSummary(updated, true);
}

export async function deleteTopic(topicId: string, user: SessionUser): Promise<void> {
  const existing = await findActiveTopicOrThrow(topicId);
  await assertManagementAccess(existing.classroomId, user);

  await prisma.topic.update({
    where: { id: topicId },
    data: { deletedAt: new Date() },
  });
}

export async function reorderTopics(
  classroomId: string,
  user: SessionUser,
  orderedTopicIds: string[],
): Promise<void> {
  await assertManagementAccess(classroomId, user);

  const existingTopics = await prisma.topic.findMany({
    where: { classroomId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existingTopics.map((topic) => topic.id));

  // Defense in depth: reject a payload that doesn't exactly match this classroom's
  // current topic set (e.g. an id from another classroom, or a missing/duplicate id).
  const isValidSet =
    orderedTopicIds.length === existingIds.size &&
    new Set(orderedTopicIds).size === orderedTopicIds.length &&
    orderedTopicIds.every((id) => existingIds.has(id));

  if (!isValidSet) {
    throw new ClassroomServiceError(
      "VALIDATION_ERROR",
      "The provided topic order doesn't match this classroom's topics.",
    );
  }

  await prisma.$transaction(
    orderedTopicIds.map((id, index) =>
      prisma.topic.update({ where: { id }, data: { position: index } }),
    ),
  );
}
