import type { ClassroomMembershipRole, ClassroomStatus } from "@/generated/prisma/enums";

export type { ActionResult } from "@/types/action-result";
export type { ClassroomMembershipRole } from "@/generated/prisma/enums";

export interface ClassroomSummary {
  id: string;
  title: string;
  section: string;
  subject: string | null;
  room: string | null;
  description: string | null;
  code: string;
  /** Never the raw storage key - the client always fetches the actual image via /api/classroom-covers/{id}, same "never expose file paths" convention as lesson attachments. */
  hasCoverImage: boolean;
  status: ClassroomStatus;
  ownerId: string;
  ownerName: string;
  /** The current viewer's membership role for this classroom. */
  role: ClassroomMembershipRole;
  createdAt: Date;
}

export interface ClassroomMemberSummary {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: ClassroomMembershipRole;
  joinedAt: Date;
}

export interface ClassroomRoster {
  teachers: ClassroomMemberSummary[];
  students: ClassroomMemberSummary[];
}

export interface PendingInvitation {
  id: string;
  email: string;
  invitedByName: string;
  createdAt: Date;
}
