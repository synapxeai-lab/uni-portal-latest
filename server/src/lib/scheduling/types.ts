export type SchedulableStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED";

/**
 * The minimal shape the generic scheduling engine needs from any content
 * type. Each feature's Prisma model has its own status enum (which may carry
 * extra values, e.g. Assignment's CLOSED) - adapters translate between that
 * and this shared shape so the engine itself never touches Prisma directly.
 */
export interface SchedulableRecord {
  id: string;
  classroomId: string;
  status: string;
  scheduledFor: Date | null;
  publishedAt: Date | null;
}

/**
 * Per-feature bridge between the shared scheduling engine and a concrete
 * Prisma model. Implemented once per content type (announcement, assignment,
 * material) inside that feature's own service file, keeping Prisma
 * specifics feature-owned while the transition rules live in one place.
 */
export interface ScheduleAdapter<Record extends SchedulableRecord = SchedulableRecord> {
  contentType: string;
  findById(id: string): Promise<Record | null>;
  /** Everything currently SCHEDULED with scheduledFor <= now - what a cron/worker would publish. */
  findDueForPublishing(now: Date): Promise<Record[]>;
  /** Feature-specific eligibility check (e.g. classroom archived, assignment closed). Throws to block. */
  assertSchedulable?(record: Record): Promise<void> | void;
  updateSchedule(
    id: string,
    input: { status: "DRAFT" | "SCHEDULED"; scheduledFor: Date | null },
  ): Promise<void>;
  publish(id: string, publishedById: string | null, publishedAt: Date): Promise<Record>;
  /** Side effects that should only fire once content actually becomes visible (e.g. notifications). */
  afterPublish?(record: Record): Promise<void>;
}
