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

  it("counts weighted items by their own weightage and pools the rest into what the category has left", () => {
    const weights = weightsFor([
      { id: 1, weightage: 20 },
      { id: 2, weightage: 80 },
    ])!;
    const summary = summarizeMarks(
      [
        { categoryId: 1, obtained: 10, total: 10, weightage: 15 }, // 15% at 100%
        { categoryId: 1, obtained: 2, total: 2 }, // the 5% left, at 100%
        { categoryId: 1, obtained: null, total: 10, weightage: 0.5 }, // not marked yet: holds its share
        { categoryId: 2, obtained: 25, total: 50 }, // 80% at 50%
      ],
      null,
      undefined,
      null,
      weights,
    );
    // (15*1 + 4.5*1 + 80*0.5) / 99.5
    expect(summary.percentage).toBe(60);
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

interface ItemSheet {
  categories: {
    id: number;
    type: string;
    allocated: number;
    assessments: { id: number; title: string; totalMarks: number; weightage: number | null; assignment: { id: string; status: string } | null }[];
  }[];
}

describe("classwork on the marksheet", () => {
  let admin: ApiSession;
  let teacher: ApiSession;
  let sheetPath: string;
  let courseId: number;
  let classroomId: string;
  let assignmentId: string | undefined;
  let manualItemId: number | undefined;

  const itemOf = async (id: string) =>
    (await teacher.get<ItemSheet>(sheetPath)).data.categories.flatMap((c) =>
      c.assessments.filter((a) => a.assignment?.id === id).map((a) => ({ ...a, category: c.type })),
    )[0];

  beforeAll(async () => {
    admin = await signIn("admin");
    teacher = await signIn("teacher");
    const grades = await teacher.get<{
      offerings: { sectionId: number; courseId: number; classroomId: string | null; course: { code: string }; section: { label: string } }[];
    }>("/grades");
    const offering = grades.data.offerings.find((o) => o.course.code === "DTM-TDW" && o.section.label === "A")!;
    courseId = offering.courseId;
    classroomId = offering.classroomId!;
    sheetPath = `/marks/${offering.sectionId}/${offering.courseId}`;
  });

  afterAll(async () => {
    if (manualItemId) await teacher.delete(`/marks/assessments/${manualItemId}`);
    if (assignmentId) await teacher.delete(`/classrooms/${classroomId}/assignments/${assignmentId}`);
  });

  it("offers the course scheme's categories with the weightage still free", async () => {
    const res = await teacher.get<{ categories: { type: string; weightage: number; allocated: number }[] }>(
      `/classrooms/${classroomId}/marks-categories`,
    );
    expect(res.data.categories.map((c) => c.type)).toEqual(["QUIZ", "ASSIGNMENT", "MID", "FINAL"]);
    expect(res.data.categories.find((c) => c.type === "QUIZ")!.weightage).toBe(15);
  });

  it("puts graded classwork on the marksheet, within its category's weightage", async () => {
    const base = { title: "Marksheet quiz (test)", points: "10", status: "DRAFT", marksCategory: "QUIZ" };
    const tooMuch = await teacher.post(`/classrooms/${classroomId}/assignments`, { ...base, marksWeightage: "16" });
    expect(tooMuch.status).toBe(400);
    const ungraded = await teacher.post(`/classrooms/${classroomId}/assignments`, { ...base, points: "" });
    expect(ungraded.status).toBe(400);

    const created = await teacher.post<{ id: string; marks: { category: string; title: string; weightage: number } }>(
      `/classrooms/${classroomId}/assignments`,
      { ...base, marksWeightage: "5" },
    );
    assignmentId = created.data.id;
    expect(created.data.marks).toMatchObject({ category: "QUIZ", weightage: 5 });

    const item = await itemOf(assignmentId);
    expect(item).toMatchObject({ category: "QUIZ", totalMarks: 10, weightage: 5 });
    expect(item.assignment!.status).toBe("DRAFT");
    // Its marksheet item leaves from the classroom, not from the Marks page.
    expect((await teacher.delete(`/marks/assessments/${item.id}`)).status).toBe(409);
  });

  it("follows the assignment's points and category, and caps every item at what's left", async () => {
    const edit = (body: object) =>
      teacher.patch(`/classrooms/${classroomId}/assignments/${assignmentId}`, { title: "Marksheet quiz (test)", ...body });
    expect((await edit({ points: "20", marksCategory: "QUIZ", marksWeightage: "5" })).status).toBe(200);
    expect(await itemOf(assignmentId!)).toMatchObject({ category: "QUIZ", totalMarks: 20 });

    expect((await edit({ points: "20", marksCategory: "ASSIGNMENT", marksWeightage: "6" })).status).toBe(200);
    const moved = await itemOf(assignmentId!);
    expect(moved).toMatchObject({ category: "ASSIGNMENT", weightage: 6 });
    expect(moved.title).toMatch(/^Assignment \d+$/);

    // A physical item on the Marks page shares the same 15%: 6% is taken.
    const sheet = (await teacher.get<ItemSheet>(sheetPath)).data;
    const assignments = sheet.categories.find((c) => c.type === "ASSIGNMENT")!;
    const over = await teacher.post(`/marks/categories/${assignments.id}/assessments`, {
      totalMarks: 10,
      weightage: 15 - assignments.allocated + 0.5,
    });
    expect(over.status).toBe(400);
    const manual = await teacher.post<{ assessment: { id: number } }>(`/marks/categories/${assignments.id}/assessments`, {
      totalMarks: 10,
      weightage: 1,
    });
    manualItemId = manual.data.assessment.id;
    expect((await teacher.put(`/marks/assessments/${manualItemId}`, { totalMarks: 10, weightage: 15 })).status).toBe(400);
  });

  it("won't let the scheme drop a category below what its items carry", async () => {
    const { course } = (
      await admin.get<{ course: { theoryPercent: number; assessmentScheme: { id: number; type: string; component: string; weightage: number }[] } }>(
        `/courses/${courseId}`,
      )
    ).data;
    const entries = course.assessmentScheme.map(({ id, type, component, weightage }) => ({
      id,
      type,
      component,
      weightage: type === "ASSIGNMENT" ? 2 : weightage,
    }));
    const res = await admin.put(`/courses/${courseId}/assessment-scheme`, { theoryPercent: course.theoryPercent, entries });
    expect(res.status).toBe(409);
  });

  it("takes the item off the marksheet when the work goes off it or is deleted", async () => {
    const off = await teacher.patch(`/classrooms/${classroomId}/assignments/${assignmentId}`, {
      title: "Marksheet quiz (test)",
      points: "20",
      marksCategory: "",
    });
    expect(off.status).toBe(200);
    expect(await itemOf(assignmentId!)).toBeUndefined();

    await teacher.patch(`/classrooms/${classroomId}/assignments/${assignmentId}`, {
      title: "Marksheet quiz (test)",
      points: "20",
      marksCategory: "QUIZ",
    });
    expect(await itemOf(assignmentId!)).toBeDefined();
    expect((await teacher.delete(`/classrooms/${classroomId}/assignments/${assignmentId}`)).status).toBe(200);
    expect(await itemOf(assignmentId!)).toBeUndefined();
    assignmentId = undefined;
  });
});
