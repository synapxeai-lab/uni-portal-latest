import { beforeAll, describe, expect, it } from "vitest";

import { ApiSession, signIn } from "./helpers/api";

/**
 * Checks the data imported from the two legacy apps (npm run db:import-legacy).
 * Skipped on a database without it.
 */
const GCR_ADMIN = { email: "faizan.admin@gcr.dev", password: "F@izan4121" };
// The portal teacher who was assigned courses there.
const UP_TEACHER_EMAIL = "teacher@example.com";
const GCR_TEACHER = { email: "daniel.teacher@gcr.dev", password: "Testpass123!" };

describe("imported legacy data", async () => {
  const admin = await signIn("admin");
  const users = await admin.get<{ users: { id: string; email: string }[] }>(`/admin/users?q=${encodeURIComponent(UP_TEACHER_EMAIL)}`);
  const imported = users.data.users.length > 0;

  describe.skipIf(!imported)("with the import", () => {
    let upTeacherPassword: string;

    beforeAll(async () => {
      const viewed = await admin.get<{ password: string | null }>(`/admin/users/${users.data.users[0].id}/password`);
      upTeacherPassword = viewed.data.password!;
    });

    it("keeps GCR accounts signing in with their old password", async () => {
      const session = await new ApiSession().login(GCR_ADMIN.email, GCR_ADMIN.password);
      const me = await session.get<{ user: { role: string } }>("/auth/session");
      expect(me.data.user.role).toBe("ADMIN");
    });

    it("keeps portal passwords viewable and working, with the teacher's classes", async () => {
      expect(upTeacherPassword).toBeTruthy();
      const teacher = await new ApiSession().login(UP_TEACHER_EMAIL, upTeacherPassword);
      const classrooms = await teacher.get<{ offering: unknown }[]>("/classrooms");
      expect(classrooms.data.some((c) => c.offering !== null)).toBe(true);
      const summary = await teacher.get<{ teaching: unknown[] }>("/university/summary");
      expect(summary.data.teaching.length).toBeGreaterThan(0);
    });

    it("keeps GCR's classroom with its classwork", async () => {
      const session = await new ApiSession().login(GCR_TEACHER.email, GCR_TEACHER.password);
      const classrooms = await session.get<{ id: string; title: string }[]>("/classrooms");
      const math = classrooms.data.find((c) => c.title === "Advanced Mathematics 101")!;
      const classwork = await session.get<{ assignments: unknown[] }>(`/classrooms/${math.id}/classwork`);
      expect(classwork.data.assignments.length).toBe(2);
    });

    it("brings over the portal's structure", async () => {
      const departments = await admin.get<{ departments: { code: string }[] }>("/departments");
      expect(departments.data.departments.map((d) => d.code)).toEqual(expect.arrayContaining(["DCS", "DPCS", "AHP", "AFO"]));
    });
  });
});
