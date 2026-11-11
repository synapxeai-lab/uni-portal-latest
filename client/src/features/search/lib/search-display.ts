import {
  BookOpen,
  ClipboardList,
  Layers,
  Megaphone,
  Paperclip,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import type { SearchEntityType } from "../types";

/** Shared label/icon per entity type - reused by both the search dialog and the full results page, so the two surfaces never drift. */
export const ENTITY_TYPE_LABEL: Record<SearchEntityType, string> = {
  classroom: "Classroom",
  announcement: "Announcement",
  assignment: "Assignment",
  material: "Material",
  topic: "Topic",
  user: "User",
};

export const ENTITY_TYPE_LABEL_PLURAL: Record<SearchEntityType, string> = {
  classroom: "Classrooms",
  announcement: "Announcements",
  assignment: "Assignments",
  material: "Materials",
  topic: "Topics",
  user: "Users",
};

export const ENTITY_TYPE_ICON: Record<SearchEntityType, LucideIcon> = {
  classroom: BookOpen,
  announcement: Megaphone,
  assignment: ClipboardList,
  material: Paperclip,
  topic: Layers,
  user: UserRound,
};
