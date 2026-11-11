import { apiAction } from "@/lib/api";

import type { SchedulableContentType } from "./types";

// Same signatures as the old scheduling Server Actions. Callers refresh their
// page data (router.refresh) after a success.

export function scheduleContent(
  contentType: SchedulableContentType,
  contentId: string,
  scheduledFor: string,
) {
  return apiAction(
    "post",
    `/scheduling/${contentType}/${contentId}/schedule`,
    { scheduledFor },
    "Couldn't schedule this content. Please try again.",
  );
}

export function cancelScheduledPublication(contentType: SchedulableContentType, contentId: string) {
  return apiAction(
    "post",
    `/scheduling/${contentType}/${contentId}/cancel`,
    undefined,
    "Couldn't cancel the scheduled publication. Please try again.",
  );
}

export function publishNow(contentType: SchedulableContentType, contentId: string) {
  return apiAction(
    "post",
    `/scheduling/${contentType}/${contentId}/publish`,
    undefined,
    "Couldn't publish this content. Please try again.",
  );
}
