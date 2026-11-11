import type { SessionUser } from "@/auth/session";
import {
  assertClassroomActive,
  assertManagementAccess,
  assertMembership,
  hasManagementAccess,
  loadActiveClassroom,
} from "@/features/classroom/services/classroom-service";
import { ClassroomServiceError } from "@/features/classroom/lib/errors";
import {
  notifyAnnouncementPublished,
  notifyClassComment,
} from "@/features/notifications/services/notification-generator";
import { recordAuditEvent } from "@/lib/audit-log";
import { getFileAttachmentsByEntityIds } from "@/lib/file-attachments";
import { prisma } from "@/lib/prisma";
import { deleteAttachment, uploadAttachments } from "@/lib/storage/file-service";
import type { Prisma } from "@/generated/prisma/client";
import {
  ActivityAction,
  AnnouncementStatus,
  ClassroomStatus,
  CommentVisibility,
  FileAttachmentType,
} from "@/generated/prisma/enums";
import type { ScheduleAdapter, SchedulableRecord } from "@/lib/scheduling/types";

import type { AnnouncementAttachmentSummary, AnnouncementSummary, CommentSummary } from "../types";

// An announcement is considered "edited" if it was updated meaningfully after
// creation - a small threshold avoids flagging clock-precision no-ops as edits.
const EDITED_THRESHOLD_MS = 60_000;
const MAX_TITLE_LENGTH = 120;

function announcementWithRelationsInclude() {
  return {
    author: { select: { id: true, name: true, image: true, avatarUrl: true } },
    comments: {
      where: { deletedAt: null },
      include: { author: { select: { id: true, name: true, image: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    },
  } as const;
}

async function createAnnouncementRecord(
  data: Prisma.AnnouncementCreateArgs["data"],
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  return client.announcement.create({ data, include: announcementWithRelationsInclude() });
}

type AnnouncementWithRelations = Awaited<ReturnType<typeof createAnnouncementRecord>>;
type CommentWithAuthor = AnnouncementWithRelations["comments"][number];

function toCommentSummary(
  comment: CommentWithAuthor,
  viewerId: string,
  canModerate: boolean,
): CommentSummary {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      image: comment.author.image ?? comment.author.avatarUrl ?? null,
    },
    canDelete: canModerate || comment.authorId === viewerId,
  };
}

function toAnnouncementSummary(
  announcement: AnnouncementWithRelations,
  attachments: AnnouncementAttachmentSummary[],
  viewerId: string,
  canModerate: boolean,
): AnnouncementSummary {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    createdAt: announcement.createdAt,
    isEdited:
      announcement.updatedAt.getTime() - announcement.createdAt.getTime() > EDITED_THRESHOLD_MS,
    isPinned: announcement.isPinned,
    status: announcement.status,
    scheduledFor: announcement.scheduledFor,
    author: {
      id: announcement.author.id,
      name: announcement.author.name,
      image: announcement.author.image ?? announcement.author.avatarUrl ?? null,
    },
    comments: announcement.comments.map((comment) =>
      toCommentSummary(comment, viewerId, canModerate),
    ),
    attachments,
    canManage: canModerate,
  };
}

// Used by update/delete/pin, all of which require management access
// immediately afterward - so draft and scheduled announcements are fine to
// load here too (a manager needs to be able to edit content before it
// publishes). createComment has its own, stricter PUBLISHED-only lookup below.
async function findActiveAnnouncementOrThrow(announcementId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { classroom: { select: { status: true } } },
  });

  if (!announcement || announcement.deletedAt) {
    throw new ClassroomServiceError("NOT_FOUND", "Announcement not found.");
  }

  return announcement;
}

// Announcement.title is required by the schema but the composer only collects a
// body - derive a short title from the content so no fake/placeholder text is stored.
function deriveTitleFromContent(content: string): string {
  const trimmed = content.trim();

  if (trimmed.length <= MAX_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 3)}...`;
}

export async function listClassroomAnnouncements(
  classroomId: string,
  viewer: SessionUser,
): Promise<AnnouncementSummary[]> {
  const canModerate = await hasManagementAccess(classroomId, viewer);

  const announcements = await prisma.announcement.findMany({
    where: {
      classroomId,
      deletedAt: null,
      // Draft/Scheduled announcements are only visible to whoever manages
      // this classroom - students never see content before it publishes.
      ...(canModerate ? {} : { status: AnnouncementStatus.PUBLISHED }),
    },
    include: announcementWithRelationsInclude(),
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  if (announcements.length === 0) {
    return [];
  }

  const attachmentsByAnnouncementId = await getFileAttachmentsByEntityIds(
    announcements.map((announcement) => announcement.id),
    FileAttachmentType.ANNOUNCEMENT,
  );

  return announcements.map((announcement) =>
    toAnnouncementSummary(
      announcement,
      attachmentsByAnnouncementId.get(announcement.id) ?? [],
      viewer.id,
      canModerate,
    ),
  );
}

export async function createAnnouncement(
  classroomId: string,
  user: SessionUser,
  content: string,
  status:
    | typeof AnnouncementStatus.DRAFT
    | typeof AnnouncementStatus.SCHEDULED
    | typeof AnnouncementStatus.PUBLISHED,
  scheduledFor: Date | null,
  files: File[] = [],
): Promise<AnnouncementSummary> {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });

  if (!classroom || classroom.status === ClassroomStatus.DELETED) {
    throw new ClassroomServiceError("NOT_FOUND", "Classroom not found.");
  }

  assertClassroomActive(classroom, "This class is archived and can't accept new announcements.");

  // Per-classroom check (not just a global role check) - a TEACHER who doesn't
  // teach this specific classroom can't post to it.
  await assertManagementAccess(classroomId, user);

  const created = await prisma.$transaction(async (tx) => {
    const announcement = await createAnnouncementRecord(
      {
        classroomId,
        authorId: user.id,
        title: deriveTitleFromContent(content),
        content,
        status,
        scheduledFor: status === AnnouncementStatus.SCHEDULED ? scheduledFor : null,
        publishedAt: status === AnnouncementStatus.PUBLISHED ? new Date() : null,
        publishedById: status === AnnouncementStatus.PUBLISHED ? user.id : null,
      },
      tx,
    );

    await uploadAttachments({
      files,
      attachmentType: FileAttachmentType.ANNOUNCEMENT,
      entityId: announcement.id,
      uploadedById: user.id,
      tx,
    });

    return announcement;
  });

  if (status === AnnouncementStatus.PUBLISHED) {
    await notifyAnnouncementPublished({
      classroomId,
      classroomTitle: classroom.title,
      authorId: user.id,
      announcementId: created.id,
      announcementContent: content,
    });
  }

  const attachmentsByAnnouncementId = await getFileAttachmentsByEntityIds(
    [created.id],
    FileAttachmentType.ANNOUNCEMENT,
  );
  return toAnnouncementSummary(
    created,
    attachmentsByAnnouncementId.get(created.id) ?? [],
    user.id,
    true,
  );
}

export async function updateAnnouncement(
  announcementId: string,
  user: SessionUser,
  content: string,
  files: File[] = [],
): Promise<AnnouncementSummary> {
  const existing = await findActiveAnnouncementOrThrow(announcementId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  const updated = await prisma.announcement.update({
    where: { id: announcementId },
    data: {
      content,
      title: deriveTitleFromContent(content),
    },
    include: announcementWithRelationsInclude(),
  });

  // Editing only ever adds new attachments here - removing an existing one is
  // its own explicit action (removeAnnouncementAttachment).
  await uploadAttachments({
    files,
    attachmentType: FileAttachmentType.ANNOUNCEMENT,
    entityId: announcementId,
    uploadedById: user.id,
  });

  const attachmentsByAnnouncementId = await getFileAttachmentsByEntityIds(
    [announcementId],
    FileAttachmentType.ANNOUNCEMENT,
  );
  return toAnnouncementSummary(
    updated,
    attachmentsByAnnouncementId.get(announcementId) ?? [],
    user.id,
    true,
  );
}

export async function removeAnnouncementAttachment(
  announcementId: string,
  fileAttachmentId: string,
  user: SessionUser,
): Promise<void> {
  const existing = await findActiveAnnouncementOrThrow(announcementId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be edited.",
  );
  await assertManagementAccess(existing.classroomId, user);

  const attachment = await prisma.fileAttachment.findUnique({ where: { id: fileAttachmentId } });
  if (
    !attachment ||
    attachment.attachmentType !== FileAttachmentType.ANNOUNCEMENT ||
    attachment.entityId !== announcementId
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Attachment not found.");
  }

  await deleteAttachment(fileAttachmentId);
}

export async function deleteAnnouncement(announcementId: string, user: SessionUser): Promise<void> {
  const existing = await findActiveAnnouncementOrThrow(announcementId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be deleted.",
  );
  await assertManagementAccess(existing.classroomId, user);

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { deletedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: user.id,
    action: ActivityAction.DELETED,
    entityType: "Announcement",
    entityId: announcementId,
    targetLabel: existing.title,
    classroomId: existing.classroomId,
  });
}

export async function setAnnouncementPinned(
  announcementId: string,
  user: SessionUser,
  pinned: boolean,
): Promise<AnnouncementSummary> {
  const existing = await findActiveAnnouncementOrThrow(announcementId);
  assertClassroomActive(
    existing.classroom,
    "This class is archived and its content can't be changed.",
  );
  await assertManagementAccess(existing.classroomId, user);

  const updated = await prisma.announcement.update({
    where: { id: announcementId },
    data: { isPinned: pinned },
    include: announcementWithRelationsInclude(),
  });

  const attachmentsByAnnouncementId = await getFileAttachmentsByEntityIds(
    [announcementId],
    FileAttachmentType.ANNOUNCEMENT,
  );
  return toAnnouncementSummary(
    updated,
    attachmentsByAnnouncementId.get(announcementId) ?? [],
    user.id,
    true,
  );
}

export async function createComment(
  announcementId: string,
  user: SessionUser,
  content: string,
): Promise<CommentSummary> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { classroom: { include: { settings: true } } },
  });

  if (
    !announcement ||
    announcement.deletedAt ||
    announcement.status !== AnnouncementStatus.PUBLISHED
  ) {
    throw new ClassroomServiceError("NOT_FOUND", "Announcement not found.");
  }

  assertClassroomActive(
    announcement.classroom,
    "This class is archived and can't accept new comments.",
  );

  // Any active member (any role) may comment - unlike posting an announcement,
  // this doesn't require management rights.
  await assertMembership(announcement.classroomId, user);

  if (announcement.classroom.settings && !announcement.classroom.settings.allowComments) {
    throw new ClassroomServiceError("FORBIDDEN", "Comments are turned off for this class.");
  }

  const created = await prisma.comment.create({
    data: {
      announcementId,
      authorId: user.id,
      content,
      visibility: CommentVisibility.PUBLIC,
    },
    include: { author: { select: { id: true, name: true, image: true, avatarUrl: true } } },
  });

  await notifyClassComment({
    classroomId: announcement.classroomId,
    classroomTitle: announcement.classroom.title,
    announcementId,
    announcementTitle: announcement.title,
    authorId: user.id,
    authorName: created.author.name,
    commentContent: content,
  });

  const canModerate = await hasManagementAccess(announcement.classroomId, user);
  return toCommentSummary(created, user.id, canModerate);
}

/**
 * A cheap fingerprint of everything the stream renders (announcements and
 * their comments, including edits, pins and soft-deletes - all of which bump
 * updatedAt). Open stream pages poll it and re-render only when it changes,
 * so new comments/posts from other members show up without a reload.
 */
export async function getStreamVersion(classroomId: string, viewer: SessionUser): Promise<string> {
  await assertMembership(classroomId, viewer);

  const [announcements, comments] = await Promise.all([
    prisma.announcement.aggregate({
      where: { classroomId },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.comment.aggregate({
      where: { announcement: { classroomId } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);

  return [
    announcements._count._all,
    announcements._max.updatedAt?.getTime() ?? 0,
    comments._count._all,
    comments._max.updatedAt?.getTime() ?? 0,
  ].join(":");
}

export async function deleteComment(commentId: string, user: SessionUser): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { announcement: { select: { classroomId: true } } },
  });

  if (!comment || comment.deletedAt || !comment.announcement) {
    throw new ClassroomServiceError("NOT_FOUND", "Comment not found.");
  }

  const isOwnComment = comment.authorId === user.id;
  const canModerate = await hasManagementAccess(comment.announcement.classroomId, user);

  if (!isOwnComment && !canModerate) {
    throw new ClassroomServiceError(
      "FORBIDDEN",
      "You do not have permission to delete this comment.",
    );
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

interface SchedulableAnnouncement extends SchedulableRecord {
  title: string;
}

function toSchedulableAnnouncement(announcement: {
  id: string;
  classroomId: string;
  status: AnnouncementStatus;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  title: string;
}): SchedulableAnnouncement {
  return {
    id: announcement.id,
    classroomId: announcement.classroomId,
    status: announcement.status,
    scheduledFor: announcement.scheduledFor,
    publishedAt: announcement.publishedAt,
    title: announcement.title,
  };
}

/**
 * Bridges Announcement to the shared scheduling engine (src/lib/scheduling).
 * This is the only place Prisma specifics for announcement scheduling live -
 * scheduleContent/cancelScheduledPublication/publishNow/publishScheduledContent
 * all operate purely in terms of this adapter.
 */
export const announcementScheduleAdapter: ScheduleAdapter<SchedulableAnnouncement> = {
  contentType: "announcement",

  async findById(id) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement || announcement.deletedAt) {
      return null;
    }
    return toSchedulableAnnouncement(announcement);
  },

  async findDueForPublishing(now) {
    const announcements = await prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.SCHEDULED,
        scheduledFor: { lte: now },
        deletedAt: null,
      },
    });
    return announcements.map(toSchedulableAnnouncement);
  },

  async assertSchedulable(record) {
    const classroom = await loadActiveClassroom(record.classroomId);
    assertClassroomActive(
      classroom,
      "This class is archived and its announcements can't be scheduled or published.",
    );
  },

  async updateSchedule(id, input) {
    await prisma.announcement.update({
      where: { id },
      data: {
        status:
          input.status === "SCHEDULED" ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
        scheduledFor: input.scheduledFor,
      },
    });
  },

  async publish(id, publishedById, publishedAt) {
    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.PUBLISHED,
        scheduledFor: null,
        publishedAt,
        publishedById,
      },
    });
    return toSchedulableAnnouncement(updated);
  },

  async afterPublish(record) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: record.id },
      include: { classroom: { select: { title: true } } },
    });
    if (!announcement) {
      return;
    }
    await notifyAnnouncementPublished({
      classroomId: announcement.classroomId,
      classroomTitle: announcement.classroom.title,
      authorId: announcement.authorId,
      announcementId: announcement.id,
      announcementContent: announcement.content,
    });
  },
};
