import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ApiSession, signIn, unique } from "./helpers/api";

interface Challan {
  id: number;
  amount: number;
  status: string;
}

const cnic = () => `${10000 + Math.floor(Math.random() * 89999)}-${String(Date.now()).slice(-7)}-${Math.floor(Math.random() * 9)}`;

describe("fee challans", () => {
  let admin: ApiSession;
  let student: ApiSession;
  let studentId: number;
  let courseId: number;
  let extraFeeId: number | undefined;

  beforeAll(async () => {
    admin = await signIn("admin");
    const created = await admin.post<{ student: { id: number }; login: { email: string; password: string } }>("/students", {
      name: "Fee Tester",
      rollNo: unique("FEE"),
      email: `${unique("fee")}@eithm.edu.pk`,
      phone: "0300",
      address: "Lahore",
      cnic: cnic(),
      dob: "2005-01-01",
      gender: "FEMALE",
      lastQualification: "FSc",
      passingYear: 2024,
      grade: "A",
      university: "BISE",
      programme: "TOURISM",
      batch: "2026",
      section: "A",
      guardianName: "G",
      guardianContact: "0300",
      guardianCnic: cnic(),
      guardianRelationship: "Mother",
      guardianEmail: "g@example.com",
    });
    studentId = created.data.student.id;
    student = await new ApiSession().login(created.data.login.email, created.data.login.password);
    const page = await student.get<{ courses: { id: number; code: string; defaultSectionId: number }[] }>("/my/registration");
    const course = page.data.courses.find((c) => c.code === "DTM-TDW")!;
    courseId = course.id;
    await student.post("/my/registration", { courseId, sectionId: course.defaultSectionId });
  });

  afterAll(async () => {
    if (extraFeeId) await admin.delete(`/courses/${courseId}/fees/${extraFeeId}`);
    await admin.delete(`/students/${studentId}`);
  });

  const myChallan = async () => (await student.get<{ challans: Challan[] }>("/my/challans")).data.challans[0];

  it("bills the registered course and lets the student report payment once", async () => {
    const challan = await myChallan();
    expect(challan.amount).toBe(18000); // DTM-TDW fee, no discount for a single course
    expect(challan.status).toBe("UNPAID");

    expect((await student.post(`/my/challans/${challan.id}/pay`)).status).toBe(200);
    expect((await myChallan()).status).toBe("PENDING_APPROVAL");
    expect((await student.post(`/my/challans/${challan.id}/pay`)).status).toBe(400);
  });

  it("lets an admin approve a pending payment", async () => {
    const pending = await admin.get<{ challans: (Challan & { student: { id: number } })[] }>(
      `/challans?status=PENDING_APPROVAL&studentId=${studentId}`,
    );
    const challan = pending.data.challans[0];
    expect(challan.student.id).toBe(studentId);
    expect((await admin.put(`/challans/${challan.id}/approve`)).status).toBe(200);
    expect((await admin.put(`/challans/${challan.id}/approve`)).status).toBe(400);
    expect((await myChallan()).status).toBe("PAID");
  });

  it("re-opens a paid challan when the course fee goes up", async () => {
    const added = await admin.post<{ course: { extraFees: { id: number; name: string }[] } }>(`/courses/${courseId}/fees`, {
      name: unique("Excursion"),
      amount: 2000,
    });
    extraFeeId = added.data.course.extraFees.at(-1)!.id;
    const challan = await myChallan();
    expect(challan.amount).toBe(20000);
    expect(challan.status).toBe("UNPAID");
  });

  it("shows admins teachers' pay and keeps fees admin/student scoped", async () => {
    const pay = await admin.get<{ teachers: { email: string; type: string; pay: number; creditHours: number }[] }>("/teachers-pay");
    const visiting = pay.data.teachers.find((t) => t.email === "bilal.ahmed@eithm.edu.pk")!;
    expect(visiting.type).toBe("VISITING");
    expect(visiting.pay).toBe(visiting.creditHours * 6500);
    const teacher = await signIn("teacher");
    expect((await teacher.get("/challans")).status).toBe(403);
    expect((await teacher.get("/my/challans")).status).toBe(403);
  });
});
