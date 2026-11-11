import type { AssignmentStatus, MaterialType } from "@portal/shared/enums";
import type { AttachedFileSummary } from "@/lib/file-attachments";

export type { ActionResult } from "@/types/action-result";
export type { MaterialType, AssignmentStatus } from "@portal/shared/enums";
export type MaterialAttachedFile = AttachedFileSummary;

export interface TopicSummary {
  id: string;
  title: string;
  position: number;
  /** Whether the current viewer may create/rename/delete/reorder topics. */
  canManage: boolean;
}

export interface MaterialSummary {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  type: MaterialType;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  scheduledFor: Date | null;
  topicId: string | null;
  authorName: string;
  createdAt: Date;
  attachments: MaterialAttachedFile[];
  /** Whether the current viewer may edit/delete this material. */
  canManage: boolean;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  description: string | null;
  status: AssignmentStatus;
  scheduledFor: Date | null;
  dueDate: Date | null;
  points: number | null;
  /** When false, students can't turn work in once the due date has passed. */
  allowLateSubmission: boolean;
  topicId: string | null;
  authorName: string;
  createdAt: Date;
  attachments: AttachedFileSummary[];
  /** Whether the current viewer may edit/publish/close/delete this assignment. */
  canManage: boolean;
}
