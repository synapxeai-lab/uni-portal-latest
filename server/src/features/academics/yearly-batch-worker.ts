import { invalidateUniversity } from "@/lib/cache/tags";

import { ensureYearlyBatchSections } from "./lib/section-sync";

const INTERVAL_MS = 60 * 60_000;

async function tick(): Promise<void> {
  try {
    const created = await ensureYearlyBatchSections();
    if (created > 0) {
      invalidateUniversity();
      console.log(`[batches] created ${created} default section(s) for the new yearly batch`);
    }
  } catch (error) {
    console.error("[batches] creating the yearly batch's sections failed", error);
  }
}

/**
 * Each 1 September a new yearly batch appears without anyone adding it; this
 * gives every diploma Sections A and B in it - on start-up and then hourly.
 * Safe on several instances: sections are unique per diploma, batch and label.
 */
export function startYearlyBatchWorker(): () => void {
  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
