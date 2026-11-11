import { assignmentScheduleAdapter } from "@/features/classwork/services/assignment-service";
import { materialScheduleAdapter } from "@/features/classwork/services/material-service";
import { announcementScheduleAdapter } from "@/features/stream/services/stream-service";
import { SchedulingServiceError } from "@/lib/scheduling/errors";
import type { ScheduleAdapter } from "@/lib/scheduling/types";

import type { SchedulableContentType } from "../types";

/**
 * The single place the content-type scheduling adapters are wired together,
 * so the generic engine in lib/scheduling stays feature-agnostic.
 */
const REGISTRY: Record<SchedulableContentType, ScheduleAdapter> = {
  announcement: announcementScheduleAdapter,
  assignment: assignmentScheduleAdapter,
  material: materialScheduleAdapter,
};

export function getScheduleAdapter(contentType: SchedulableContentType): ScheduleAdapter {
  const adapter = REGISTRY[contentType];
  if (!adapter) {
    throw new SchedulingServiceError("NOT_FOUND", "Content not found.");
  }
  return adapter;
}

/** Every adapter, in registration order - what the publish worker iterates over. */
export function getAllScheduleAdapters(): ScheduleAdapter[] {
  return Object.values(REGISTRY);
}
