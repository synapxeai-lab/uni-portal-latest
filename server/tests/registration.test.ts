import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { feeForCourses } from "@/features/academics/lib/challans";

import { ApiSession, signIn, unique } from "./helpers/api";

interface OfferedCourse {
  id: number;
  code: string;
  creditHours: number;
  defaultSectionId: number | null;
  registered: boolean;
}
interface MyRegistration {
  registrationOpen: boolean;
  registration?: { id: number; semester: string; year: number };
  diploma?: { code: string } | null;
  courses: OfferedCourse[];
  creditLimit?: number;
  creditsUsed?: number;
  message?: string | null;
}

const cnic = () => `${10000 + Math.floor(Math.random() * 89999)}-${String(Date.now()).slice(-7)}-${Math.floor(Math.random() * 9)}`;

describe("challan amounts", () => {
  const department = { discountRate: 10, courses: [{ id: 1 }, { id: 2 }] };
  const course = (id: number, fee: number, discountRate = 0) => ({
    id,
    fee,
    discountRate,
    departmentId: 1,
    extraFees: [],
    department,
  });

  it("charges each course less its own discount, or the whole diploma less its discount", () => {
    expect(feeForCourses([course(1, 1000, 50)])).toBe(500);
    expect(feeForCourses([course(1, 1000, 50), course(2, 1000)])).toBe(1800);
  });
});

describe("student registration", () => {
  let admin: ApiSession;
  let student: ApiSession;
  let studentId: number;
  let registrationId: number;

  beforeAll(async () => {
    admin = await signIn("admin");
    const created = await admin.post<{ student: { id: number }; login: { email: string; password: string } }>("/students", {
      name: "Registration Tester",
      rollNo: unique("REG"),
      email: `${unique("reg")}@eithm.edu.pk`,
      phone: "0300",
      address: "Lahore",
      cnic: cnic(),
      dob: "2005-01-01",
      gender: "MALE",
      lastQualification: "FSc",
      passingYear: 2024,
      grade: "A",
      university: "BISE",
      programme: "TOURISM",
      batch: "2026",
      section: "B",
      guardianName: "G",
      guardianContact: "0300",
      guardianCnic: cnic(),
      guardianRelationship: "Father",
      guardianEmail: "g@example.com",
    });
    studentId = created.data.student.id;
    student = await new ApiSession().login(created.data.login.email, created.data.login.password);
  });

  afterAll(async () => {
    if (registrationId) {
      await admin.delete(`/registrations/${registrationId}/limits/2026`);
    }
    await admin.delete(`/students/${studentId}`);
  });

  it("shows every role the current term", async () => {
    const current = await student.get<{ registration: { status: string } | null }>("/registrations/current");
    expect(current.data.registration?.status).toBe("ACTIVE");
  });

  it("offers the student's diploma for this term, defaulting to their section", async () => {
    const page = await student.get<MyRegistration>("/my/registration");
    expect(page.data.registrationOpen).toBe(true);
    expect(page.data.diploma?.code).toBe("DTM");
    expect(page.data.courses.length).toBeGreaterThanOrEqual(4);
    expect(page.data.courses.every((c) => !c.registered && c.defaultSectionId)).toBe(true);
    registrationId = page.data.registration!.id;
  });

  it("registers a course, adds the student to its classroom and bills it, within the credit limit", async () => {
    // Allow only one 3-credit course.
    await admin.put(`/registrations/${registrationId}/limits`, { batch: "2026", creditLimit: 4 });

    const page = (await student.get<MyRegistration>("/my/registration")).data;
    const [first, second] = page.courses.filter((c) => c.creditHours === 3);

    const registered = await student.post("/my/registration", { courseId: first.id, sectionId: first.defaultSectionId });
    expect(registered.status).toBe(201);

    const again = await student.post("/my/registration", { courseId: first.id, sectionId: first.defaultSectionId });
    expect(again.status).toBe(409);

    const overLimit = await student.post<unknown>("/my/registration", { courseId: second.id, sectionId: second.defaultSectionId });
    expect(overLimit.status).toBe(400);
    expect(JSON.stringify(overLimit.body)).toMatch(/credit limit of 4/);

    // In the classroom now.
    const classrooms = await student.get<{ offering: { courseId: number } | null }[]>("/classrooms");
    expect(classrooms.data.some((c) => c.offering?.courseId === first.id)).toBe(true);

    // And on "my courses".
    const mine = await student.get<{ groups: { courses: { id: number; classroomId: string | null }[] }[] }>("/my/courses");
    const course = mine.data.groups[0].courses.find((c) => c.id === first.id);
    expect(course?.classroomId).toBeTruthy();
  });

  it("keeps registration admin-managed and student pages student-only", async () => {
    expect((await student.get("/registrations")).status).toBe(403);
    expect((await admin.get("/my/registration")).status).toBe(403);
    // The open semester must end before another registration can start.
    const another = await admin.post("/registrations", {
      semester: "SPRING",
      startDate: "2027-01-01",
      endDate: "2027-01-20",
      semesterStart: "2027-01-05",
      semesterEnd: "2027-05-30",
    });
    expect(another.status).toBe(409);
  });
});

describe("deleting a registered student", () => {
  it("takes them off their classes' rosters", async () => {
    const admin = await signIn("admin");
    const created = await admin.post<{ student: { id: number }; login: { email: string; password: string } }>("/students", {
      name: "Roster Leaver",
      rollNo: unique("LEAVE"),
      email: `${unique("leave")}@eithm.edu.pk`,
      phone: "0300",
      address: "Lahore",
      cnic: cnic(),
      dob: "2005-01-01",
      gender: "MALE",
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
    const student = await new ApiSession().login(created.data.login.email, created.data.login.password);
    const page = (await student.get<MyRegistration>("/my/registration")).data;
    const course = page.courses[0];
    await student.post("/my/registration", { courseId: course.id, sectionId: course.defaultSectionId });
    const classroom = (await student.get<{ id: string; offering: { courseId: number } | null }[]>("/classrooms")).data.find(
      (c) => c.offering?.courseId === course.id,
    )!;

    const people = async () =>
      (await admin.get<{ roster: { students: { email: string }[] } }>(`/classrooms/${classroom.id}/people`)).data.roster.students.map(
        (s) => s.email,
      );
    expect(await people()).toContain(created.data.login.email);
    await admin.delete(`/students/${created.data.student.id}`);
    expect(await people()).not.toContain(created.data.login.email);
  });
});
