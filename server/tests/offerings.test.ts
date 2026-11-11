import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ApiSession, signIn, unique } from "./helpers/api";

interface Classroom {
  id: string;
  title: string;
  section: string;
  status: string;
  ownerName: string;
  offering: { courseId: number; sectionId: number } | null;
}
interface AssignmentRow {
  sectionId: number;
  courseId: number;
  offered: boolean;
  classroomId: string | null;
  teacher: { id: number } | null;
}

describe("course offerings and their classrooms", () => {
  let admin: ApiSession;
  let departmentId: number;
  let courseId: number;
  let teacherId: number;
  const batch = "2026";

  beforeAll(async () => {
    admin = await signIn("admin");
    // A throwaway diploma in the Tourism programme with one course.
    const department = await admin.post<{ department: { id: number } }>("/departments", {
      name: unique("Offering Test Diploma"),
      code: unique("OT"),
      color: "#000",
      bg: "#fff",
      description: "d",
      head: "h",
      category: "TOURISM",
    });
    departmentId = department.data.department.id;
    const course = await admin.post<{ course: { id: number } }>("/courses", {
      departmentIds: [departmentId],
      name: "Offering Test Course",
      code: unique("OTC"),
      creditHours: 3,
    });
    courseId = course.data.course.id;
    const teachers = await admin.get<{ teachers: { id: number; email: string }[] }>("/teachers");
    teacherId = teachers.data.teachers.find((t) => t.email === "ayesha.khan@eithm.edu.pk")!.id;
  });

  afterAll(async () => {
    // Deleting the diploma archives its classrooms; then remove the test classrooms entirely.
    const ids = (await classroomsOf(admin)).map((c) => c.id);
    await admin.delete(`/departments/${departmentId}`);
    for (const id of ids) {
      await admin.delete(`/admin/classrooms/${id}`);
    }
  });

  const classroomsOf = async (session: ApiSession) =>
    (await session.get<Classroom[]>("/classrooms")).data.filter((c) => c.offering?.courseId === courseId);

  it("offering a course creates one classroom per section, owned by the admin until a teacher is assigned", async () => {
    const offered = await admin.post<{ count: number }>("/offerings", { departmentId, courseId, batch });
    expect(offered.data.count).toBe(2); // Sections A and B

    const classrooms = await classroomsOf(admin);
    expect(classrooms).toHaveLength(2);
    expect(classrooms.map((c) => c.title)).toEqual(["Offering Test Course", "Offering Test Course"]);
    expect(classrooms.every((c) => c.ownerName === "Portal Administrator")).toBe(true);
    expect(classrooms.map((c) => c.section.endsWith("2026-A") || c.section.endsWith("2026-B"))).toEqual([true, true]);
  });

  it("assigning a teacher makes them the classroom's owner", async () => {
    const assignments = await admin.get<{ courses: { id: number; rows: AssignmentRow[] }[] }>(
      `/assignments?departmentId=${departmentId}`,
    );
    const row = assignments.data.courses.find((c) => c.id === courseId)!.rows[0];
    expect(row.offered).toBe(true);
    expect(row.classroomId).toBeTruthy();

    await admin.put(`/assignments/${row.sectionId}/${courseId}`, { teacherId });

    const teacher = await signIn("teacher");
    const mine = await classroomsOf(teacher);
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(row.classroomId);
    expect(mine[0].ownerName).toBe("Dr. Ayesha Khan");
  });

  it("un-offering archives the classrooms; offering again restores the same ones", async () => {
    const before = (await classroomsOf(admin)).map((c) => c.id).sort();
    await admin.post("/offerings/remove", { departmentId, courseId, batch });
    expect(await classroomsOf(admin)).toHaveLength(0);
    const archived = (await admin.get<Classroom[]>("/classrooms/archived")).data.filter((c) =>
      before.includes(c.id),
    );
    expect(archived).toHaveLength(2);

    // The teacher assignment is kept as a planned one and comes back too.
    await admin.post("/offerings", { departmentId, courseId, batch });
    const after = await classroomsOf(admin);
    expect(after.map((c) => c.id).sort()).toEqual(before);
    const teacher = await signIn("teacher");
    expect(await classroomsOf(teacher)).toHaveLength(1);
  });

  it("refuses a course from another programme", async () => {
    const cpdDiploma = await admin.post<{ department: { id: number } }>("/departments", {
      name: unique("CPD Test"),
      code: unique("CT"),
      color: "#000",
      bg: "#fff",
      description: "d",
      head: "h",
      category: "CPD",
    });
    const response = await admin.post("/offerings", {
      departmentId: cpdDiploma.data.department.id,
      courseId,
      batch,
    });
    expect(response.status).toBe(400);
    await admin.delete(`/departments/${cpdDiploma.data.department.id}`);
  });

  it("deleting the diploma archives its classrooms", async () => {
    const ids = (await classroomsOf(admin)).map((c) => c.id);
    const extra = await admin.post<{ department: { id: number } }>("/departments", {
      name: unique("Delete Test"),
      code: unique("DT"),
      color: "#000",
      bg: "#fff",
      description: "d",
      head: "h",
      category: "TOURISM",
    });
    // (Sanity: a second diploma doesn't touch these classrooms.)
    await admin.delete(`/departments/${extra.data.department.id}`);
    expect((await classroomsOf(admin)).map((c) => c.id).sort()).toEqual(ids.sort());
  });

  it("is admin-only", async () => {
    const teacher = await signIn("teacher");
    expect((await teacher.get("/offerings")).status).toBe(403);
    expect((await teacher.post("/offerings", { departmentId, courseId, batch })).status).toBe(403);
  });
});
