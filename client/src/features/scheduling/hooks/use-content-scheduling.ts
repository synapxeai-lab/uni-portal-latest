import { useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";

import { cancelScheduledPublication, publishNow, scheduleContent } from "../api";
import type { SchedulableContentType } from "../types";

/**
 * Shared client-side wiring for Schedule / Cancel scheduled publication /
 * Publish now, reused identically by the announcement, assignment, and
 * material management menus - each menu only supplies its own trigger UI.
 */
export function useContentScheduling(contentType: SchedulableContentType, contentId: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  function confirmSchedule(scheduledFor: string) {
    startTransition(async () => {
      const result = await scheduleContent(contentType, contentId, scheduledFor);
      if (result.status === "success") {
        toast.success("Publication scheduled");
        setScheduleDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function cancelSchedule() {
    startTransition(async () => {
      const result = await cancelScheduledPublication(contentType, contentId);
      if (result.status === "success") {
        toast.success("Scheduled publication cancelled");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function publishImmediately() {
    startTransition(async () => {
      const result = await publishNow(contentType, contentId);
      if (result.status === "success") {
        toast.success("Published");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return {
    isPending,
    scheduleDialogOpen,
    openScheduleDialog: () => setScheduleDialogOpen(true),
    closeScheduleDialog: () => setScheduleDialogOpen(false),
    confirmSchedule,
    cancelSchedule,
    publishImmediately,
  };
}
