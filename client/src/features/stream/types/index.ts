import type { AttachedFileSummary } from "@/lib/file-attachments";

export type { ActionResult } from "@/types/action-result";
export type { AnnouncementStatus } from "@portal/shared/enums";

export type AnnouncementAttachmentSummary = AttachedFileSummary;

export interface CommentSummary {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  /** Whether the current viewer may delete this specific comment. */
  canDelete: boolean;
}

export interface AnnouncementSummary {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  isEdited: boolean;
  isPinned: boolean;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  scheduledFor: Date | null;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  comments: CommentSummary[];
  attachments: AnnouncementAttachmentSummary[];
  /** Whether the current viewer may edit/delete/pin this announcement. */
  canManage: boolean;
}

/** A published assignment or material, shown in the stream as "X posted a new …". */
export interface StreamClassworkItem {
  kind: "ASSIGNMENT" | "MATERIAL";
  id: string;
  title: string;
  /** DOCUMENT, LINK, VIDEO, IMAGE or OTHER for a material; null for an assignment. */
  materialType: string | null;
  /** When it went out to the class. */
  postedAt: Date;
  dueDate: Date | null;
  points: number | null;
  author: { id: string; name: string; image: string | null };
}
