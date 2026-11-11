import { invalidateAllAcademic } from "@/lib/cache/tags";
import { publishScheduledContent } from "@/lib/scheduling/content-scheduling-service";

import { getAllScheduleAdapters } from "./lib/adapter-registry";

const INTERVAL_MS = 60_000;

let running = false;

async function tick(): Promise<void> {
  // A slow batch must never overlap the next one.
  if (running) {
    return;
  }
  running = true;
  try {
    const published = await publishScheduledContent(getAllScheduleAdapters());
    if (published.length > 0) {
      // The batch can span any classroom - drop every classroom-derived entry.
      invalidateAllAcademic();
      console.log(`[scheduler] published ${published.length} scheduled item(s)`);
    }
  } catch (error) {
    console.error("[scheduler] publishing scheduled content failed", error);
  } finally {
    running = false;
  }
}

/**
 * Publishes announcements, materials and assignments whose scheduled time
 * has passed, once a minute. The Next.js app exposed this only as an
 * admin-triggered action (it had no long-running process to host a timer);
 * the Express server runs it in-process. The adapters publish by id without
 * a status guard, so with several API instances each would publish (and
 * notify) the same due item - when scaling out, set
 * SCHEDULED_PUBLISH_WORKER=false on all but one instance.
 */
export function startScheduledPublishWorker(): () => void {
  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
