import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { computeStudentSemester, currentDiploma, termOn } from "@/features/academics/lib/terms";
import { applyDiscount, courseTotalFee } from "@/features/academics/lib/fee";

import { type ApiSession, signIn, unique } from "./helpers/api";

interface Category {
  id: number;
  key: string;
  slug: string;
  label: string;
}
interface Department {
  id: number;
  code: string;
  semester: number;
  fee: number;
  netFee: number;
  sections: { id: number; label: string; batch: string }[];
}
interface Course {
  id: number;
  code: string;
  departmentId: number;
  status: string;
  totalFee?: number;
}

describe("term and fee rules", () => {
  it("counts semesters from the Fall intake", () => {
    expect(computeStudentSemester(2026, "FALL", 2026)).toBe(1);
    expect(computeStudentSemester(2026, "SPRING", 2027)).toBe(2);
    expect(computeStudentSemester(2026, "SUMMER", 2027)).toBe(2);
    expect(computeStudentSemester(2026, "FALL", 2027)).toBe(3);
    expect(computeStudentSemester(null, "FALL", 2026)).toBeNull();
  });

  it("maps months to terms", () => {
    expect(termOn(new Date(2027, 0, 10))).toEqual({ semester: "SPRING", year: 2027 });
    expect(termOn(new Date(2027, 6, 1))).toEqual({ semester: "SUMMER", year: 2027 });
    expect(termOn(new Date(2026, 10, 11))).toEqual({ semester: "FALL", year: 2026 });
  });

  it("holds a student at the first diploma before the batch starts and the last after it ends", () => {
    const diplomas = [{ semester: 1 }, { semester: 2 }];
    expect(currentDiploma(diplomas, 2027, { semester: "FALL", year: 2026 })).toBe(diplomas[0]);
    expect(currentDiploma(diplomas, 2026, { semester: "SPRING", year: 2027 })).toBe(diplomas[1]);
    expect(currentDiploma(diplomas, 2020, { semester: "FALL", year: 2026 })).toBe(diplomas[1]);
  });

  it("adds extra fees and applies discounts", () => {
    expect(courseTotalFee({ fee: 1000, extraFees: [{ amount: 250 }, { amount: 50 }] })).toBe(1300);
    expect(applyDiscount(1300, 10)).toBe(1170);
  });
});

describe("academic structure API", () => {
  let admin: ApiSession;
  let category: Category;
  let first: Department;
  let second: Department;
  const batch = unique("B").slice(0, 12);

  beforeAll(async () => {
    admin = await signIn("admin");
  });

  afterAll(async () => {
    // Clean up everything this file created.
    for (const department of [first, second]) {
      if (department) {
        await admin.delete(`/departments/${department.id}`);
      }
    }
    await admin.delete(`/batches/${encodeURIComponent(batch)}`);
    if (category) {
      await admin.delete(`/programme-categories/${category.id}`);
    }
  });

  it("creates a main programme with a key and slug from its name", async () => {
    const label = `${unique("Aviation")} Programmes`;
    const created = await admin.post<{ category: Category }>("/programme-categories", {
      label,
      description: "Test programme",
    });
    expect(created.status).toBe(201);
    category = created.data.category;
    expect(category.key).toMatch(/^AVIATION/);
    expect(category.slug).toMatch(/^aviation/);

    const duplicate = await admin.post("/programme-categories", { label, description: "x" });
    expect(duplicate.status).toBe(409);
  });

  it("numbers diplomas within a programme and refuses a semester clash", async () => {
    const base = { color: "#000", bg: "#fff", description: "d", head: "h", category: category.key };
    first = (
      await admin.post<{ department: Department }>("/departments", {
        ...base,
        name: unique("Diploma One"),
        code: unique("D1"),
      })
    ).data.department;
    second = (
      await admin.post<{ department: Department }>("/departments", {
        ...base,
        name: unique("Diploma Two"),
        code: unique("D2"),
      })
    ).data.department;
    expect(first.semester).toBe(1);
    expect(second.semester).toBe(2);

    const clash = await admin.put(`/departments/${second.id}`, { semester: 1 });
    expect(clash.status).toBe(409);

    const badProgramme = await admin.post("/departments", {
      ...base,
      category: "NO_SUCH_PROGRAMME",
      name: unique("x"),
      code: unique("x"),
    });
    expect(badProgramme.status).toBe(400);
  });

  it("refuses to delete a programme that still has diplomas", async () => {
    expect((await admin.delete(`/programme-categories/${category.id}`)).status).toBe(409);
  });

  it("adds one course to two diplomas, copies and prices it", async () => {
    const code = unique("C");
    const created = await admin.post<{ courses: Course[] }>("/courses", {
      departmentIds: [first.id, second.id],
      name: "Shared Course",
      code,
      creditHours: 3,
      fee: 10000,
    });
    expect(created.data.courses).toHaveLength(2);
    const [course] = created.data.courses;
    expect(course.status).toBe("INACTIVE");

    const again = await admin.post("/courses", {
      departmentIds: [first.id],
      name: "Shared Course",
      code,
      creditHours: 3,
    });
    expect(again.status).toBe(409);

    const withFee = await admin.post<{ course: Course }>(`/courses/${course.id}/fees`, {
      name: "Lab Fee",
      amount: 2500,
    });
    expect(withFee.data.course.totalFee).toBe(12500);
    expect((await admin.post(`/courses/${course.id}/fees`, { name: "lab fee", amount: 1 })).status).toBe(409);

    const diploma = await admin.get<{ department: Department }>(`/departments/${first.id}`);
    expect(diploma.data.department.fee).toBe(12500);

    const copyToSame = await admin.post(`/courses/${course.id}/copy`, { departmentId: second.id });
    expect(copyToSame.status).toBe(409);
  });

  it("adds a batch with Sections A and B in every diploma, and the next section letter", async () => {
    const created = await admin.post("/batches", { name: batch, year: 2027 });
    expect(created.status).toBe(201);

    const diploma = await admin.get<{ department: Department }>(`/departments/${first.id}`);
    const labels = diploma.data.department.sections.filter((s) => s.batch === batch).map((s) => s.label);
    expect(labels.sort()).toEqual(["A", "B"]);

    const third = await admin.post<{ section: { label: string } }>("/sections", {
      departmentId: first.id,
      batch,
    });
    expect(third.data.section.label).toBe("C");

    const list = await admin.get<{ details: { name: string; year: number }[] }>("/batches");
    expect(list.data.details).toContainEqual({ name: batch, year: 2027 });
  });

  it("lets every role read programmes and batches, but only admins manage diplomas", async () => {
    const student = await signIn("student");
    expect((await student.get("/programme-categories")).status).toBe(200);
    expect((await student.get("/batches")).status).toBe(200);
    expect((await student.get("/departments")).status).toBe(403);
    expect((await student.post("/batches", { name: "X1", year: 2027 })).status).toBe(403);
  });
});
