import { beforeAll, describe, expect, it } from "vitest";

import { payError, teacherPay } from "@/features/academics/lib/teacher-pay";

import { ApiSession, type ApiSession as Session, signIn, unique } from "./helpers/api";

interface Teacher {
  id: number;
  email: string;
  userId: string | null;
}
interface Student {
  id: number;
  email: string;
  userId: string | null;
  currentDiploma: { code: string } | null;
}
interface Login {
  email: string;
  password: string;
}

const cnic = () => `${String(Math.floor(10000 + Math.random() * 89999))}-${String(Date.now()).slice(-7)}-${Math.floor(Math.random() * 9)}`;

describe("teacher pay rules", () => {
  it("requires a salary or rate depending on the type", () => {
    expect(payError({ type: "PERMANENT", salary: null })).toMatch(/Salary/);
    expect(payError({ type: "VISITING", ratePerCreditHour: null })).toMatch(/Rate/);
    expect(payError({ type: "VISITING", ratePerCreditHour: 100 })).toBeNull();
  });

  it("pays visiting teachers per credit hour taught", () => {
    const links = [{ course: { creditHours: 3 } }, { course: { creditHours: 4 } }];
    expect(teacherPay({ type: "VISITING", ratePerCreditHour: 1000, sectionCourses: links })).toEqual({ creditHours: 7, pay: 7000 });
    expect(teacherPay({ type: "PERMANENT", salary: 50000, sectionCourses: links }).pay).toBe(50000);
  });
});

describe("people API", () => {
  let admin: Session;

  beforeAll(async () => {
    admin = await signIn("admin");
  });

  it("creates a teacher with a login, syncs edits to it and archives it on delete", async () => {
    const email = `${unique("teacher")}@eithm.edu.pk`;
    const created = await admin.post<{ teacher: Teacher; login: Login }>("/teachers", {
      name: "Test Teacher",
      phone: "0300-0000000",
      email,
      address: "Lahore",
      cnic: cnic(),
      qualification: "MSc",
      programme: "TOURISM",
      type: "VISITING",
      ratePerCreditHour: 5000,
      guardianName: "G",
      guardianContact: "0300",
      guardianCnic: cnic(),
    });
    expect(created.status).toBe(201);
    const { teacher, login } = created.data;
    expect(teacher.userId).toBeTruthy();
    expect(login.email).toBe(email);

    // The new login works straight away.
    const session = await new ApiSession().login(email, login.password);
    const me = await session.get<{ user: { role: string; name: string } }>("/auth/session");
    expect(me.data.user.role).toBe("TEACHER");

    // Renaming the profile renames the login.
    await admin.put(`/teachers/${teacher.id}`, { name: "Renamed Teacher" });
    const users = await admin.get<{ users: { id: string; name: string; status: string }[] }>(
      `/admin/users?q=${encodeURIComponent(email)}`,
    );
    expect(users.data.users[0].name).toBe("Renamed Teacher");

    // Deleting the profile archives (doesn't delete) the login and signs it out.
    expect((await admin.delete(`/teachers/${teacher.id}`)).status).toBe(200);
    const after = await admin.get<{ users: { status: string }[] }>(`/admin/users?q=${encodeURIComponent(email)}&status=ARCHIVED`);
    expect(after.data.users[0].status).toBe("ARCHIVED");
    expect((await session.get("/auth/session")).body).not.toHaveProperty("user.role", "TEACHER");
  });

  it("refuses a visiting teacher without a rate", async () => {
    const response = await admin.post("/teachers", {
      name: "No Rate",
      phone: "1",
      email: `${unique("norate")}@eithm.edu.pk`,
      address: "a",
      cnic: cnic(),
      qualification: "q",
      programme: "TOURISM",
      type: "VISITING",
      guardianName: "g",
      guardianContact: "1",
      guardianCnic: cnic(),
    });
    expect(response.status).toBe(400);
  });

  it("creates a student, links their section and shows the current diploma", async () => {
    const email = `${unique("student")}@eithm.edu.pk`;
    const created = await admin.post<{ student: Student; login: Login }>("/students", {
      name: "Test Student",
      rollNo: unique("ROLL"),
      email,
      phone: "0300",
      address: "Lahore",
      cnic: cnic(),
      dob: "2005-04-01",
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
      guardianRelationship: "Father",
      guardianEmail: "g@example.com",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const { student } = created.data;

    const detail = await admin.get<{ student: Student & { enrolledSections: { label: string; department: { code: string } }[] } }>(
      `/students/${student.id}`,
    );
    expect(detail.data.student.currentDiploma?.code).toBe("DTM");
    // Section A of every Tourism diploma in batch 2026.
    expect(detail.data.student.enrolledSections.map((s) => s.department.code).sort()).toEqual(["DHM", "DTM"]);

    // Duplicate roll number / email is refused.
    const duplicate = await admin.post("/students", { ...created.data.student, cnic: cnic() });
    expect(duplicate.status).toBeGreaterThanOrEqual(400);

    await admin.delete(`/students/${student.id}`);
  });

  it("rejects bad input with field errors", async () => {
    const response = await admin.post<unknown>("/students", { name: "X", email: "not-an-email", cnic: "123" });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("fieldErrors.email");
    expect(response.body).toHaveProperty("fieldErrors.cnic");
  });

  it("keeps people records admin-only", async () => {
    const teacher = await signIn("teacher");
    expect((await teacher.get("/students")).status).toBe(403);
    expect((await teacher.get("/teachers")).status).toBe(403);
  });
});
