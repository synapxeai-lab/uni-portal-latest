import { Router } from "express";

import { cached } from "@/lib/cache/tagged-cache";
import { CacheTags, CacheTtl, invalidateUniversity } from "@/lib/cache/tags";
import { currentUser, requireAdmin, requireRole } from "@/middleware/auth";
import { UserRole } from "@/generated/prisma/enums";

import { done, intParam, intQuery, strQuery } from "./lib/http";
import * as fees from "./services/fee-service";

/** Fee challans (students pay, admins approve) and teachers' pay. */
export const feesRouter = Router();

const read = <T>(key: string, load: () => Promise<T>) =>
  cached(key, { ttl: CacheTtl.LIVE, tags: [CacheTags.UNIVERSITY] }, load);

// ---- Students --------------------------------------------------------------------------

feesRouter.get("/my/challans", requireRole(UserRole.STUDENT), async (req, res) => {
  const userId = currentUser(req).id;
  res.json(await read(`my-challans:${userId}`, () => fees.getMyChallans(userId)));
});

feesRouter.post("/my/challans/:id/pay", requireRole(UserRole.STUDENT), async (req, res) => {
  const challan = await fees.payChallan(currentUser(req).id, intParam(req, "id", "challan ID"));
  invalidateUniversity();
  done(res, { challan, message: "Payment submitted. It's marked paid once an administrator approves it." });
});

// ---- Admin -----------------------------------------------------------------------------

feesRouter.get("/challans", requireAdmin, async (req, res) => {
  const params = {
    status: strQuery(req, "status"),
    programme: strQuery(req, "programme"),
    search: strQuery(req, "search"),
    studentId: intQuery(req, "studentId"),
  };
  res.json(await read(`challans:${JSON.stringify(params)}`, () => fees.listChallans(params)));
});

feesRouter.put("/challans/:id/approve", requireAdmin, async (req, res) => {
  const challan = await fees.approveChallan(intParam(req, "id", "challan ID"));
  invalidateUniversity();
  done(res, { challan, message: "Challan approved as paid." });
});

feesRouter.post("/challans/recalculate", requireAdmin, async (_req, res) => {
  await fees.recalculateAllChallans();
  invalidateUniversity();
  done(res, { message: "Every challan recalculated from current fees." });
});

feesRouter.get("/teachers-pay", requireAdmin, async (_req, res) => {
  res.json({ teachers: await read("teachers-pay", fees.teachersPay) });
});
