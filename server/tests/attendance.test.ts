import { beforeAll, describe, expect, it } from "vitest";

import { type ApiSession, ApiSession as Session, signIn } from "./helpers/api";

interface Overview {
  offerings: { sectionId: number; courseId: number; course: { code: string }; section: { label: string }; students: number }[];
}
interface AttendancePage {
  roster: { enrollmentId: number; student: { name: string }; status: string | null }[];
  dates: { date: string; total: number }[];
}

describe("attendance", () => {
  let admin: ApiSession;
  let teacher: ApiSession; // Dr. Ayesha Khan teaches DTM-TDW section A
  let path: string;

  beforeAll(async () => {
    admin = await signIn("admin");
    teacher = await signIn("teacher");
    const overview = await admin.get<Overview>("/attendance");
    const offering = overview.data.offerings.find((o) => o.course.code === "DTM-TDW" && o.section.label === "A")!;
    expect(offering.students).toBeGreaterThan(0);
    path = `/attendance/${offering.sectionId}/${offering.courseId}`;
  });

  it("lets the assigned teacher take attendance for a day", async () => {
    const day = "2026-10-05";
    const page = await teacher.get<AttendancePage>(`${path}?date=${day}`);
    expect(page.data.roster.length).toBeGreaterThan(0);

    const records = page.data.roster.map((r, i) => ({ enrollmentId: r.enrollmentId, status: i === 0 ? "ABSENT" : "PRESENT" }));
    const saved = await teacher.post<{ saved: number }>(path, { date: day, records: [...records, { enrollmentId: 999999, status: "PRESENT" }] });
    expect(saved.data.saved).toBe(records.length); // the foreign enrollment is ignored

    const after = await teacher.get<AttendancePage>(`${path}?date=${day}`);
    expect(after.data.roster[0].status).toBe("ABSENT");
    expect(after.data.dates.some((d) => d.date.startsWith(day))).toBe(true);
  });

  it("refuses a teacher who doesn't teach the section, and bad input", async () => {
    const other = await new Session().login("sana.mirza@eithm.edu.pk", "Teacher@123");
    expect((await other.get(path)).status).toBe(404);
    expect((await teacher.post(path, { date: "not-a-date", records: [] })).status).toBe(400);
  });

  it("shows students their own attendance with a percentage", async () => {
    const student = await signIn("student");
    const mine = await student.get<{ groups: { courses: { code: string; summary: { total: number; percentage: number | null } }[] }[] }>(
      "/my/attendance",
    );
    const course = mine.data.groups[0].courses.find((c) => c.code === "DTM-TDW")!;
    expect(course.summary.total).toBeGreaterThan(0);
    expect(course.summary.percentage).not.toBeNull();
    expect((await student.get(path)).status).toBe(404);
  });
});
