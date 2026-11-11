import { Router, type Request } from "express";

import { parseParams } from "@/http/validate";
import { currentUser, requireAdmin } from "@/middleware/auth";
import { invalidateAllAcademic, invalidateClassroom } from "@/lib/cache/tags";
import * as schedulingService from "@/lib/scheduling/content-scheduling-service";
import { SchedulingServiceError } from "@/lib/scheduling/errors";
import { assertManagementAccess } from "@/features/classroom/services/classroom-service";

import { getAllScheduleAdapters, getScheduleAdapter } from "./lib/adapter-registry";
import { contentIdentifierSchema, scheduleContentSchema } from "./validation/schedule-schema";

export const schedulingRouter = Router();

/** Only whoever manages the content's classroom (or an admin) may schedule/publish it. */
async function authorizeContent(req: Request) {
  const { contentType, contentId } = parseParams(
    contentIdentifierSchema,
    req.params,
    "Invalid content.",
  );
  const adapter = getScheduleAdapter(contentType);
  const user = currentUser(req);

  const record = await adapter.findById(contentId);
  if (!record) {
    throw new SchedulingServiceError("NOT_FOUND", "Content not found.");
  }

  await assertManagementAccess(record.classroomId, user);
  return { adapter, user, contentId, classroomId: record.classroomId };
}

/** "Schedule for later" for a draft, or reschedule an already-scheduled item. */
schedulingRouter.post("/:contentType/:contentId/schedule", async (req, res) => {
  const parsed = scheduleContentSchema.safeParse({
    ...req.params,
    scheduledFor: req.body?.scheduledFor,
  });
  if (!parsed.success) {
    throw new SchedulingServiceError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  const { adapter, contentId, classroomId } = await authorizeContent(req);
  await schedulingService.scheduleContent(adapter, contentId, new Date(parsed.data.scheduledFor));
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

/** Cancel a pending scheduled publish - reverts the content back to Draft. */
schedulingRouter.post("/:contentType/:contentId/cancel", async (req, res) => {
  const { adapter, contentId, classroomId } = await authorizeContent(req);
  await schedulingService.cancelScheduledPublication(adapter, contentId);
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

/** Publish a draft or scheduled item immediately. */
schedulingRouter.post("/:contentType/:contentId/publish", async (req, res) => {
  const { adapter, user, contentId, classroomId } = await authorizeContent(req);
  await schedulingService.publishNow(adapter, contentId, user.id);
  invalidateClassroom(classroomId);
  res.json({ status: "success", data: undefined });
});

/** Admin trigger: publish everything past its scheduled time. */
schedulingRouter.post("/publish-due", requireAdmin, async (_req, res) => {
  const published = await schedulingService.publishScheduledContent(getAllScheduleAdapters());
  if (published.length > 0) {
    invalidateAllAcademic();
  }
  res.json({ status: "success", data: published });
});
