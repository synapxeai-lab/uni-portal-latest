import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateScheme } from "@/features/academics/lib/assessment-scheme";
import { computeGpa, DEFAULT_GRADES, gradeFor, validateGrades } from "@/features/academics/lib/grading";
import { summarizeMarks, weightsFor } from "@/features/academics/lib/marks-summary";

import { type ApiSession, signIn } from "./helpers/api";

describe("grading rules", () => {
  it("maps percentages to letter grades and computes a credit-weighted GPA", () => {
    expect(gradeFor(85)).toBe("A");
    expect(gradeFor(84.5)).toBe("A-");
    expect(gradeFor(10)).toBe("F");
    expect(computeGpa([{ gradePoints: 4, creditHours: 3 }, { gradePoints: 2, creditHours: 1 }])).toBe(3.5);
    expect(computeGpa([{ gradePoints: null, creditHours: 3 }])).toBeNull();
  });

  it("validates grade ranges", () => {
    expect(validateGrades(DEFAULT_GRADES)).toBeNull();
    const gap = DEFAULT_GRADES.map((g) => (g.grade === "B" ? { ...g, min: 72 } : g));
    expect(validateGrades(gap)).toMatch(/must end right below/);
  });

  it("weights categories once they total 100, counting only graded work", () => {
    const weights = weightsFor([
      { id: 1, weightage: 40 },
      { id: 2, weightage: 60 },
    ])!;
    const summary = summarizeMarks(
      [
        { categoryId: 1, obtained: 10, total: 10 },
        { categoryId: 2, obtained: 25, total: 50 },
        { categoryId: 2, obtained: null, total: 50 },
      ],
      null,
      undefined,
      null,
      weights,
    );
    expect(summary.percentage).toBe(70); // 40*1.0 + 60*0.5
    expect(summarizeMarks([], 88).grade).toBe("A");
    expect(weightsFor([{ id: 1, weightage: 50 }])).toBeNull();
  });

  it("keeps a scheme within the theory/practical split", () => {
    expect(validateScheme([{ type: "Quiz", component: "THEORY", weightage: 70 }], 60)).toMatch(/Theory/);
    expect(validateScheme([{ type: "Lab", component: "PRACTICAL", weightage: 10 }], 100)).toMatch(/no practical/);
    expect(validateScheme([{ type: "Quiz", component: "THEORY", weightage: 60 }], 60)).toBeNull();
  });
});

interface Sheet {
  categories: { id: number; type: string; assessments: { id: number; title: string; totalMarks: number }[] }[];
  students: { enrollmentId: number; student: { name: string }; summary: { percentage: number | null; grade: string | null } }[];
  weighted: boolean;
}

describe("marks and grades API", () => {
  let admin: ApiSession;
  let teacher: ApiSession;
  let student: ApiSession;
  let sheetPath: string;
  let courseId: number;
  let createdAssessmentId: number | undefined;

  beforeAll(async () => {
    admin = await signIn("admin");
    teacher = await signIn("teacher");
    student = await signIn("student");
    const overview = await admin.get<{ offerings: { sectionId: number; courseId: number; course: { code: string }; section: { label: string } }[] }>(
      "/attendance",
    );
    const offering = overview.data.offerings.find((o) => o.course.code === "DTM-TDW" && o.section.label === "A")!;
    courseId = offering.courseId;
    sheetPath = `/marks/${offering.sectionId}/${offering.courseId}`;
  });

  afterAll(async () => {
    if (createdAssessmentId) await teacher.delete(`/marks/assessments/${createdAssessmentId}`);
    await admin.delete(`/grades/releases/${courseId}`);
  });

  it("shows the teacher the course's scheme with every student's running percentage", async () => {
    const sheet = await teacher.get<Sheet>(sheetPath);
    expect(sheet.data.categories.map((c) => c.type)).toEqual(["QUIZ", "ASSIGNMENT", "MID", "FINAL"]);
    expect(sheet.data.weighted).toBe(true);
    expect(sheet.data.students.every((s) => s.summary.percentage !== null)).toBe(true);
  });

  it("adds the next quiz and saves marks within its total", async () => {
    const sheet = (await teacher.get<Sheet>(sheetPath)).data;
    const quizzes = sheet.categories.find((c) => c.type === "QUIZ")!;
    const created = await teacher.post<{ assessment: { id: number; title: string } }>(
      `/marks/categories/${quizzes.id}/assessments`,
      { totalMarks: 10 },
    );
    createdAssessmentId = created.data.assessment.id;
    expect(created.data.assessment.title).toBe(`Quiz ${quizzes.assessments.length + 1}`);

    const [first] = sheet.students;
    const over = await teacher.put(`/marks/assessments/${createdAssessmentId}/marks`, {
      records: [{ enrollmentId: first.enrollmentId, obtained: 11 }],
    });
    expect(over.status).toBe(400);
    const saved = await teacher.put<{ saved: number }>(`/marks/assessments/${createdAssessmentId}/marks`, {
      records: [{ enrollmentId: first.enrollmentId, obtained: 9 }],
    });
    expect(saved.data.saved).toBe(1);
  });

  it("lists the teacher's own course sections for the Marks and Attendance pages", async () => {
    type Offerings = { offerings: { sectionId: number; courseId: number; teacher: { name: string } | null; students: number }[] };
    const mine = (await teacher.get<Offerings>("/teaching/offerings")).data.offerings;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((o) => `/marks/${o.sectionId}/${o.courseId}` === sheetPath)).toBe(true);
    expect(new Set(mine.map((o) => o.teacher?.name)).size).toBe(1);
    const all = (await admin.get<Offerings>("/teaching/offerings")).data.offerings;
    expect(all.length).toBeGreaterThanOrEqual(mine.length);
    expect((await student.get("/teaching/offerings")).status).toBe(403);
  });

  it("saves one student's marksheet across assessments, within each item's total", async () => {
    const sheet = (await teacher.get<Sheet>(sheetPath)).data;
    const [first] = sheet.students;
    const items = sheet.categories.flatMap((c) => c.assessments).slice(0, 2);
    expect(items.length).toBeGreaterThan(0);
    const path = `/marks/enrollments/${first.enrollmentId}/marks`;
    const before = (await teacher.get<{ students: { enrollmentId: number; marks: Record<string, number | null> }[] }>(sheetPath)).data
      .students.find((s) => s.enrollmentId === first.enrollmentId)!.marks;

    const over = await teacher.put(path, { records: [{ assessmentId: items[0].id, obtained: items[0].totalMarks + 1 }] });
    expect(over.status).toBe(400);
    const foreign = await teacher.put(path, { records: [{ assessmentId: 999_999_999, obtained: 1 }] });
    expect(foreign.status).toBe(400);

    const saved = await teacher.put<{ saved: number }>(path, {
      records: items.map((a) => ({ assessmentId: a.id, obtained: a.totalMarks })),
    });
    expect(saved.data.saved).toBe(items.length);
    const after = (await teacher.get<{ students: { enrollmentId: number; marks: Record<string, number | null> }[] }>(sheetPath)).data
      .students.find((s) => s.enrollmentId === first.enrollmentId)!.marks;
    for (const a of items) expect(after[a.id]).toBe(a.totalMarks);

    // Put the seeded marks back.
    await teacher.put(path, { records: items.map((a) => ({ assessmentId: a.id, obtained: before[a.id] ?? null })) });
    expect((await student.put(path, { records: [] })).status).toBe(403);
  });

  it("refuses invalid grade ranges and lets the teacher override a grade", async () => {
    const bad = await teacher.put(`${sheetPath}/grading`, { grades: DEFAULT_GRADES.slice(1) });
    expect(bad.status).toBe(400);
    const sheet = (await teacher.get<Sheet>(sheetPath)).data;
    const target = sheet.students[0];
    const overridden = await teacher.put<{ summary: { grade: string } }>(`/marks/enrollments/${target.enrollmentId}/grade`, { grade: "B+" });
    expect(overridden.data.summary.grade).toBe("B+");
    await teacher.put(`/marks/enrollments/${target.enrollmentId}/grade`, { grade: null });
  });

  it("hides grades from students until they are generated and released", async () => {
    const before = await student.get<{ groups: { courses: { code: string; summary: { grade: string | null; percentage: number | null } }[] }[] }>(
      "/my/marks",
    );
    const course = before.data.groups[0].courses.find((c) => c.code === "DTM-TDW")!;
    expect(course.summary.grade).toBeNull();
    expect(course.summary.percentage).not.toBeNull();

    const generated = await teacher.post<{ generated: number }>("/grades/generate", {
      courseId,
      visibleFrom: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(generated.data.generated).toBeGreaterThan(0);

    const transcript = await student.get<{ semesters: { courses: { code: string; grade: string | null }[]; gpa: number | null }[] }>(
      "/my/transcript",
    );
    const row = transcript.data.semesters.flatMap((s) => s.courses).find((c) => c.code === "DTM-TDW")!;
    expect(row.grade).toMatch(/^[A-DF][+-]?$/);
    expect(transcript.data.semesters[0].gpa).not.toBeNull();

    const releases = await teacher.get<{ releases: { courseId: number; students: number }[] }>("/grades");
    expect(releases.data.releases.some((r) => r.courseId === courseId)).toBe(true);
  });

  it("keeps marks to the offering's teacher, admins and the student themselves", async () => {
    const student2 = await signIn("student");
    expect((await student2.get(sheetPath)).status).toBe(403);
    expect((await teacher.put("/marks/enrollments/1/percentage", { percentage: 90 })).status).toBe(403);
    expect((await admin.get(sheetPath)).status).toBe(200);
  });
});
