// Mirrors the enums in server/prisma/schema.prisma (same runtime shape as
// Prisma's generated enums) so the browser bundle never imports Prisma.
// Keep in sync when an enum changes in the schema.

export const UserRole = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING_PASSWORD_CHANGE: "PENDING_PASSWORD_CHANGE",
  ARCHIVED: "ARCHIVED",
  LOCKED: "LOCKED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ClassroomMembershipRole = {
  OWNER: "OWNER",
  TEACHER: "TEACHER",
  CO_TEACHER: "CO_TEACHER",
  STUDENT: "STUDENT",
  ASSISTANT: "ASSISTANT",
} as const;
export type ClassroomMembershipRole =
  (typeof ClassroomMembershipRole)[keyof typeof ClassroomMembershipRole];

export const ClassroomMembershipStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REMOVED: "REMOVED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ClassroomMembershipStatus =
  (typeof ClassroomMembershipStatus)[keyof typeof ClassroomMembershipStatus];

export const ClassroomStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;
export type ClassroomStatus = (typeof ClassroomStatus)[keyof typeof ClassroomStatus];

export const InvitationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const InvitationType = {
  EMAIL: "EMAIL",
  LINK: "LINK",
  CODE: "CODE",
} as const;
export type InvitationType = (typeof InvitationType)[keyof typeof InvitationType];

export const AnnouncementStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
} as const;
export type AnnouncementStatus = (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];

export const MaterialType = {
  DOCUMENT: "DOCUMENT",
  LINK: "LINK",
  VIDEO: "VIDEO",
  IMAGE: "IMAGE",
  OTHER: "OTHER",
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const MaterialStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
} as const;
export type MaterialStatus = (typeof MaterialStatus)[keyof typeof MaterialStatus];

export const AssignmentStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const SubmissionStatus = {
  ASSIGNED: "ASSIGNED",
  SUBMITTED: "SUBMITTED",
  LATE: "LATE",
  REVIEWED: "REVIEWED",
  RETURNED: "RETURNED",
  MISSING: "MISSING",
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const CommentVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type CommentVisibility = (typeof CommentVisibility)[keyof typeof CommentVisibility];

export const NotificationType = {
  NEW_ASSIGNMENT: "NEW_ASSIGNMENT",
  NEW_MATERIAL: "NEW_MATERIAL",
  NEW_ANNOUNCEMENT: "NEW_ANNOUNCEMENT",
  SUBMISSION_RETURNED: "SUBMISSION_RETURNED",
  PRIVATE_COMMENT: "PRIVATE_COMMENT",
  CLASS_COMMENT: "CLASS_COMMENT",
  GENERAL: "GENERAL",
  CLASS_CREATED: "CLASS_CREATED",
  CLASS_ARCHIVED: "CLASS_ARCHIVED",
  TIMESLOT_SCHEDULED: "TIMESLOT_SCHEDULED",
  TIMESLOT_UPDATED: "TIMESLOT_UPDATED",
  TIMESLOT_CANCELLED: "TIMESLOT_CANCELLED",
  TIMESLOT_CLASH: "TIMESLOT_CLASH",
  TIMESLOT_RESOLVED: "TIMESLOT_RESOLVED",
  TIMESLOT_CLASH_REPORTED: "TIMESLOT_CLASH_REPORTED",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const TimetableClashKind = {
  SECTION: "SECTION",
  ROOM: "ROOM",
} as const;
export type TimetableClashKind = (typeof TimetableClashKind)[keyof typeof TimetableClashKind];

export const TimetableClashStatus = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type TimetableClashStatus = (typeof TimetableClashStatus)[keyof typeof TimetableClashStatus];

export const FileAttachmentType = {
  ANNOUNCEMENT: "ANNOUNCEMENT",
  MATERIAL: "MATERIAL",
  ASSIGNMENT: "ASSIGNMENT",
  SUBMISSION: "SUBMISSION",
} as const;
export type FileAttachmentType = (typeof FileAttachmentType)[keyof typeof FileAttachmentType];

export const ActivityAction = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  DELETED: "DELETED",
  ARCHIVED: "ARCHIVED",
  JOINED: "JOINED",
  INVITED: "INVITED",
  SUBMITTED: "SUBMITTED",
  RETURNED: "RETURNED",
  SUSPENDED: "SUSPENDED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  RESTORED: "RESTORED",
  LOCKED: "LOCKED",
  UNLOCKED: "UNLOCKED",
  SESSION_TERMINATED: "SESSION_TERMINATED",
} as const;
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

export const ModerationStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;
export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];
