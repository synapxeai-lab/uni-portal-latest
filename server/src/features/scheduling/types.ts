export type { ActionResult } from "@/types/action-result";

/** The three content types the shared scheduling engine currently drives. */
export type SchedulableContentType = "announcement" | "assignment" | "material";

/** Counts of currently-Scheduled content per type - used by the Teacher and Admin dashboards. */
export interface ScheduledContentStats {
  announcementCount: number;
  assignmentCount: number;
  materialCount: number;
  total: number;
}

/** One item in the "Upcoming Publications" dashboard list. */
export interface UpcomingPublicationItem {
  id: string;
  contentType: SchedulableContentType;
  title: string;
  classroomId: string;
  classroomTitle: string;
  scheduledFor: Date;
}
