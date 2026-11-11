import type { ClassroomMembershipRole, ClassroomStatus } from "@/generated/prisma/enums";

export type { ActionResult } from "@/types/action-result";
export type { ClassroomMembershipRole, ClassroomStatus } from "@/generated/prisma/enums";

export interface AdminClassroomSummary {
  id: string;
  title: string;
  section: string | null;
  subject: string | null;
  code: string;
  status: ClassroomStatus;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AdminClassroomMember {
  id: string;
  name: string;
  email: string;
  role: ClassroomMembershipRole;
  joinedAt: Date;
}

export interface AdminClassroomStatistics {
  teacherCount: number;
  studentCount: number;
  topicCount: number;
  announcementCount: number;
  materialCount: number;
  assignmentCount: number;
  submissionCount: number;
}

export interface AdminClassroomDetail extends AdminClassroomSummary {
  description: string | null;
  room: string | null;
  statistics: AdminClassroomStatistics;
  members: AdminClassroomMember[];
}

export type ClassroomSortField = "title" | "status" | "createdAt" | "memberCount";
export type SortDirection = "asc" | "desc";

export interface ListClassroomsParams {
  search?: string;
  status?: ClassroomStatus;
  sortField?: ClassroomSortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface ClassroomsPage {
  classrooms: AdminClassroomSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
