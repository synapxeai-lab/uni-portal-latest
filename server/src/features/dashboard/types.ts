import type { ClassroomSummary } from "@/features/classroom/types";
import type { PlatformStats } from "@/features/admin/reports/types";
import type { ReviewQueueSummary } from "@/features/review/types";
import type { ScheduledContentStats, UpcomingPublicationItem } from "@/features/scheduling/types";

export type { UpcomingPublicationItem } from "@/features/scheduling/types";

export interface UpcomingDeadlineItem {
  id: string;
  title: string;
  classroomId: string;
  classroomTitle: string;
  dueDate: Date;
}

export interface TeacherDashboardData {
  activeClassroomCount: number;
  archivedClassroomCount: number;
  scheduledContent: ScheduledContentStats;
  reviewSummary: ReviewQueueSummary;
  upcomingPublications: UpcomingPublicationItem[];
}

export interface StudentDashboardData {
  activeClassroomCount: number;
  archivedClassrooms: ClassroomSummary[];
  upcomingDeadlines: UpcomingDeadlineItem[];
  /** Past-due or closed assignments not turned in - the To-do board's Missing tab. */
  missingAssignmentCount: number;
}

export interface AdminDashboardData {
  platformStats: PlatformStats;
  archivedClassroomCount: number;
  scheduledContent: ScheduledContentStats;
  reviewSummary: ReviewQueueSummary;
  upcomingPublications: UpcomingPublicationItem[];
}
