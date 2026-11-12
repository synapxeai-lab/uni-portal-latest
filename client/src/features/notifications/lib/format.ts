import {
  Archive,
  Bell,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  CalendarCheck,
  FileText,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  School,
  TriangleAlert,
  Undo2,
} from "lucide-react";

import type { NotificationType } from "@portal/shared/enums";

export const NOTIFICATION_TYPE_ICON: Record<NotificationType, LucideIcon> = {
  NEW_ASSIGNMENT: ClipboardCheck,
  NEW_MATERIAL: FileText,
  NEW_ANNOUNCEMENT: Megaphone,
  SUBMISSION_RETURNED: Undo2,
  PRIVATE_COMMENT: MessageSquare,
  CLASS_COMMENT: MessagesSquare,
  GENERAL: Bell,
  CLASS_CREATED: School,
  CLASS_ARCHIVED: Archive,
  TIMESLOT_SCHEDULED: CalendarCheck,
  TIMESLOT_UPDATED: CalendarClock,
  TIMESLOT_CANCELLED: CalendarX,
  TIMESLOT_CLASH: TriangleAlert,
  TIMESLOT_RESOLVED: CalendarCheck,
  TIMESLOT_CLASH_REPORTED: TriangleAlert,
};

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  NEW_ASSIGNMENT: "Assignments",
  NEW_MATERIAL: "Materials",
  NEW_ANNOUNCEMENT: "Announcements",
  SUBMISSION_RETURNED: "Graded or returned work",
  PRIVATE_COMMENT: "Private comments",
  CLASS_COMMENT: "Class comments",
  GENERAL: "General",
  CLASS_CREATED: "Class created",
  CLASS_ARCHIVED: "Class archived",
  TIMESLOT_SCHEDULED: "Class scheduled",
  TIMESLOT_UPDATED: "Class rescheduled",
  TIMESLOT_CANCELLED: "Class cancelled",
  TIMESLOT_CLASH: "Timetable clash",
  TIMESLOT_RESOLVED: "Clash resolved",
  TIMESLOT_CLASH_REPORTED: "Clash sent to admin",
};
