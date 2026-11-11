import type { SessionUser } from "@/auth/session";
import {
  assertClassroomActive,
  assertManagementAccess,
  hasManagementAccess,
  loadActiveClassroom,
} from "@/features/classroom/services/classroom-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import { notifyMaterialPublished } from "@/features/notifications/services/notification-generator";
import { getFileAttachmentsByEntityIds } from "@/lib/file-attachments";
import { prisma } from "@/lib/prisma";
import { deleteAttachment, uploadAttachments } from "@/lib/storage/file-service";
import type { Prisma } from "@/generated/prisma/client";
import {
  ClassroomStatus,
  FileAttachmentType,
  MaterialStatus,
  MaterialType,
} from "@/generated/prisma/enums";
import type { ScheduleAdapter, SchedulableRecord } from "@/lib/scheduling/types";

import { assertTopicBelongsToClassroom } from "./topic-service";
import type { MaterialAttachedFile, MaterialSummary } from "../types";

const VIDEO_URL_PATTERN = /(youtube\.com|youtu\.be|vimeo\.com)/i;

export interface MaterialInput {
  title: string;
  description?: string;
  url?: string;
  topicId?: string;
}

function materialWithAuthorInclude() {
  return { author: { select: { name: true } } } as const;
}

async function updateMaterialRecord(materialId: string, data: Prisma.MaterialUpdateInput) {
  return prisma.material.update({
    where: { id: materialId },
    data,
    include: materialWithAuthorInclude(),
  });
}

type MaterialWithAuthor = Awaited<ReturnType<typeof updateMaterialRecord>>;

function toMaterialSummary(
  material: MaterialWithAuthor,
  attachments: MaterialAttachedFile[],
  canManage: boolean,
): MaterialSummary {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    url: material.url,
    type: material.type,
    status: material.status,
    scheduledFor: material.scheduledFor,
    topicId: material.topicId,
    authorName: material.author.name,
    createdAt: material.createdAt,
    attachments,
    canManage,
  };
}

// Type is inferred from what's attached, matching Google Classroom's own UX
// (there's no explicit "type" field for the teacher to fill in).
function deriveMaterialType(url: string | undefined, files: File[]): MaterialType {
  if (url) {
    return VIDEO_URL_PATTERN.test(url) ? MaterialType.VIDEO : MaterialType.LINK;
  }

  if (files.length > 0) {
    return files.every((file) => file.type.startsWith("image/"))
      ? MaterialType.IMAGE
      : MaterialType.DOCUMENT;
  }

  return MaterialType.OTHER;
}

async function findActiveMaterialOrThrow(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { classroom: { select: { status: true } } },
  });

  if (!material || material.deletedAt) {
    throw new ClassroomServiceError("NOT_FOUND", "Material not found.");
  }

  return material;
}

export async function listClassroomMaterials(
  classroomId: string,
  viewer: SessionUser,
): Promise<MaterialSummary[]> {
  const canManage = await hasManagementAccess(classroomId, viewer);

  const materials = await prisma.material.findMany({
    where: {
      classroomId,
      deletedAt: null,
      // Draft/Scheduled materials are only visible to whoever manages this
      // classroom - students never see content before it publishes.
      ...(canManage ? {} : { status: MaterialStatus.PUBLISHED }),
    },
    include: materialWithAuthorInclude(),
    orderBy: { createdAt: "desc" },
  });

  if (materials.length === 0) {
    return [];
  }

  const attachmentsByMaterialId = await getFileAttachmentsByEntityIds(
    materials.map((material) => material.id),
    FileAttachmentType.MATERIAL,
  );

  return materials.map((material) =>
    toMaterialSummary(material, attachmentsByMaterialId.get(material.id) ?? [], canManage),
  );
}

export async function createMaterial(
  classroomId: string,
  user: SessionUser,
  input: MaterialInput,
  files: File[],
  status:
    | typeof MaterialStatus.DRAFT
    | typeof MaterialStatus.SCHEDULED
    | typeof MaterialStatus.PUBLISHED = MaterialStatus.PUBLISHED,
  scheduledFor: Date | null = null,
): Promise<MaterialSummary> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  assertClassroomActive(classroom, "This class is archived and can't accept new materials.");

  await assertManagementAccess(classroomId, user);

  if (input.topicId) {
    await assertTopicBelongsToClassroom(input.topicId, classroomId);
  }

  const type = deriveMaterialType(input.url, files);

  const created = await prisma.$transaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        classroomId,
        topicId: input.topicId ?? null,
        authorId: user.id,
        title: input.title,
        description: input.description ?? null,
        url: input.url ?? null,
        type,
        status,
        scheduledFor: status === MaterialStatus.SCHEDULED ? scheduledFor : null,
        publishedAt: status === MaterialStatus.PUBLISHED ? new Date() : null,
        publishedById: status === MaterialStatus.PUBLISHED ? user.id : null,
      },
      include: materialWithAuthorInclude(),
    });

    await uploadAttachments({
      files,
      attachmentType: FileAttachmentType.MATERIAL,
      entityId: material.id,
      uploadedById: user.id,
      tx,
    });

    return material;
  });

  if (status === MaterialStatus.PUBLISHED) {
    await notifyMaterialPublished({
      classroomId,
      classroomTitle: classroom.title,
      authorId: user.id,
      materialTitle: created.title,
    });
  }

  const attachmentsByMaterialId = await getFileAttachmentsByEntityIds(
    [created.id],
    FileAttachmentType.MATERIAL,
  );
  return toMaterialSummary(created, attachmentsByMaterialId.get(created.id) ?? [], true);
}

export async function updateMaterial(
  materialId: string,
  user: SessionUser,
  input: MaterialInput,
  files: File[] = [],
): Promise<MaterialSummary> {
  const existing = await findActiveMaterialOrThrow(materialId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  if (input.topicId) {
    await assertTopicBelongsToClassroom(input.topicId, existing.classroomId);
  }

  const updated = await updateMaterialRecord(materialId, {
    title: input.title,
    description: input.description ?? null,
    url: input.url ?? null,
    topic: input.topicId ? { connect: { id: input.topicId } } : { disconnect: true },
  });

  // Editing only ever adds new attachments here - removing an existing one is
  // its own explicit action (removeMaterialAttachment), matching the pattern
  // already used for submission attachments.
  await uploadAttachments({
    files,
    attachmentType: FileAttachmentType.MATERIAL,
    entityId: materialId,
    uploadedById: user.id,
  });

  const attachmentsByMaterialId = await getFileAttachmentsByEntityIds(
    [materialId],
    FileAttachmentType.MATERIAL,
  );
  return toMaterialSummary(updated, attachmentsByMaterialId.get(materialId) ?? [], true);
}

export async function removeMaterialAttachment(
  materialId: string,
  fileAttachmentId: string,
  user: SessionUser,
): Promise<void> {
  const existing = await findActiveMaterialOrThrow(materialId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  const attachment = await prisma.fileAttachment.findUnique({ where: { id: fileAttachmentId } });
  if (
    !attachment ||
    attachment.attachmentType !== FileAttachmentType.MATERIAL ||
    attachment.entityId !== materialId
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Attachment not found.");
  }

  await deleteAttachment(fileAttachmentId);
}

export async function deleteMaterial(materialId: string, user: SessionUser): Promise<void> {
  const existing = await findActiveMaterialOrThrow(materialId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be deleted.",
  );
  await assertManagementAccess(existing.classroomId, user);

  await prisma.material.update({
    where: { id: materialId },
    data: { deletedAt: new Date() },
  });
}

interface SchedulableMaterial extends SchedulableRecord {
  title: string;
}

function toSchedulableMaterial(material: {
  id: string;
  classroomId: string;
  status: MaterialStatus;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  title: string;
}): SchedulableMaterial {
  return {
    id: material.id,
    classroomId: material.classroomId,
    status: material.status,
    scheduledFor: material.scheduledFor,
    publishedAt: material.publishedAt,
    title: material.title,
  };
}

/** Bridges Material to the shared scheduling engine - see stream-service.ts's adapter for the counterpart. */
export const materialScheduleAdapter: ScheduleAdapter<SchedulableMaterial> = {
  contentType: "material",

  async findById(id) {
    const material = await prisma.material.findUnique({ where: { id } });
    if (!material || material.deletedAt) {
      return null;
    }
    return toSchedulableMaterial(material);
  },

  async findDueForPublishing(now) {
    const materials = await prisma.material.findMany({
      where: {
        status: MaterialStatus.SCHEDULED,
        scheduledFor: { lte: now },
        deletedAt: null,
      },
    });
    return materials.map(toSchedulableMaterial);
  },

  async assertSchedulable(record) {
    const classroom = await loadActiveClassroom(record.classroomId);
    assertClassroomActive(
      classroom,
      "This class is archived and its materials can't be scheduled or published.",
    );
  },

  async updateSchedule(id, input) {
    await prisma.material.update({
      where: { id },
      data: {
        status: input.status === "SCHEDULED" ? MaterialStatus.SCHEDULED : MaterialStatus.DRAFT,
        scheduledFor: input.scheduledFor,
      },
    });
  },

  async publish(id, publishedById, publishedAt) {
    const updated = await prisma.material.update({
      where: { id },
      data: {
        status: MaterialStatus.PUBLISHED,
        scheduledFor: null,
        publishedAt,
        publishedById,
      },
    });
    return toSchedulableMaterial(updated);
  },

  async afterPublish(record) {
    const material = await prisma.material.findUnique({
      where: { id: record.id },
      include: { classroom: { select: { title: true } } },
    });
    if (!material) {
      return;
    }
    await notifyMaterialPublished({
      classroomId: material.classroomId,
      classroomTitle: material.classroom.title,
      authorId: material.authorId,
      materialTitle: material.title,
    });
  },
};
