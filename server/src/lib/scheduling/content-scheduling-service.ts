import { SchedulingServiceError } from "./errors";
import type { SchedulableRecord, ScheduleAdapter } from "./types";

function assertFutureDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new SchedulingServiceError("VALIDATION_ERROR", "Invalid publish date.");
  }

  if (date.getTime() <= Date.now()) {
    throw new SchedulingServiceError(
      "VALIDATION_ERROR",
      "Scheduled publish time must be in the future.",
    );
  }
}

async function reload<Record extends SchedulableRecord>(
  adapter: ScheduleAdapter<Record>,
  contentId: string,
): Promise<Record> {
  const record = await adapter.findById(contentId);
  if (!record) {
    throw new SchedulingServiceError("NOT_FOUND", "Content not found.");
  }
  return record;
}

/** Teacher chooses "Schedule for later" - moves Draft (or an already-Scheduled item) into Scheduled. */
export async function scheduleContent<Record extends SchedulableRecord>(
  adapter: ScheduleAdapter<Record>,
  contentId: string,
  scheduledFor: Date,
): Promise<Record> {
  const record = await reload(adapter, contentId);

  if (record.status === "PUBLISHED") {
    throw new SchedulingServiceError(
      "INVALID_STATE",
      "This content is already published and can't be scheduled.",
    );
  }

  assertFutureDate(scheduledFor);

  if (adapter.assertSchedulable) {
    await adapter.assertSchedulable(record);
  }

  await adapter.updateSchedule(contentId, { status: "SCHEDULED", scheduledFor });
  return reload(adapter, contentId);
}

/** Teacher cancels a pending scheduled publish - reverts back to Draft. */
export async function cancelScheduledPublication<Record extends SchedulableRecord>(
  adapter: ScheduleAdapter<Record>,
  contentId: string,
): Promise<Record> {
  const record = await reload(adapter, contentId);

  if (record.status !== "SCHEDULED") {
    throw new SchedulingServiceError(
      "INVALID_STATE",
      "Only scheduled content can have its publication cancelled.",
    );
  }

  await adapter.updateSchedule(contentId, { status: "DRAFT", scheduledFor: null });
  return reload(adapter, contentId);
}

/** Teacher publishes a draft or scheduled item immediately, bypassing any scheduled time. */
export async function publishNow<Record extends SchedulableRecord>(
  adapter: ScheduleAdapter<Record>,
  contentId: string,
  publishedById: string,
): Promise<Record> {
  const record = await reload(adapter, contentId);

  if (record.status === "PUBLISHED") {
    throw new SchedulingServiceError("INVALID_STATE", "This content is already published.");
  }

  if (adapter.assertSchedulable) {
    await adapter.assertSchedulable(record);
  }

  const published = await adapter.publish(contentId, publishedById, new Date());
  if (adapter.afterPublish) {
    await adapter.afterPublish(published);
  }
  return published;
}

/**
 * Batch-publishes everything past its scheduled time, across every adapter
 * passed in. This is the function a future cron job / worker calls on an
 * interval (e.g. every minute) - see src/features/scheduling/lib/adapter-registry.ts
 * for how the concrete adapters are assembled, and README/this response's
 * "Future cron integration" notes for how to wire that trigger up.
 */
export async function publishScheduledContent(
  adapters: ScheduleAdapter[],
  now: Date = new Date(),
): Promise<{ contentType: string; contentId: string }[]> {
  const published: { contentType: string; contentId: string }[] = [];

  for (const adapter of adapters) {
    const due = await adapter.findDueForPublishing(now);

    for (const record of due) {
      try {
        if (adapter.assertSchedulable) {
          await adapter.assertSchedulable(record);
        }

        const result = await adapter.publish(record.id, null, now);
        if (adapter.afterPublish) {
          await adapter.afterPublish(result);
        }
        published.push({ contentType: adapter.contentType, contentId: record.id });
      } catch (error) {
        // A single item's classroom having since been archived (etc.)
        // shouldn't block the rest of the batch from publishing.
        console.error(
          `publishScheduledContent: failed to publish ${adapter.contentType} ${record.id}`,
          error,
        );
      }
    }
  }

  return published;
}
