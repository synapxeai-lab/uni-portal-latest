import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { offerTermDiplomas } from "@/features/academics/services/offering-service";
import { prisma } from "@/lib/prisma";

import { type ApiSession, signIn, unique } from "./helpers/api";

/**
 * Opening Fall/Spring registration offers every running batch all the courses
 * of the diploma it studies that term. Uses its own programme, diplomas and
 * far-future batches, and a far-future term, so real data is never offered.
 */
describe("automatic course offering when registration opens", () => {
  let admin: ApiSession;
  let category: { id: number; key: string };
  const diplomas: { id: number; semester: number }[] = [];
  // Intake years no real batch (or other test file) uses.
  const year = 2080 + Math.floor(Math.random() * 4);
  const batches = {
    running: { name: unique("Run").slice(0, 12), year }, // Fall year+1: semester 3, the last diploma
    notStarted: { name: unique("New").slice(0, 12), year: year + 2 },
    graduated: { name: unique("Grad").slice(0, 12), year: year - 2 },
  };
  const fall = { semester: "FALL" as const, year: year + 1 };

  const offeredTo = (batch: string) =>
    prisma.sectionCourse.findMany({
      where: { section: { batch, department: { category: category.key } } },
      select: { courseId: true, section: { select: { label: true, departmentId: true } } },
    });

  beforeAll(async () => {
    admin = await signIn("admin");
    category = (
      await admin.post<{ category: { id: number; key: string } }>("/programme-categories", {
        label: `${unique("Auto Offer")} Programmes`,
        description: "Test programme",
      })
    ).data.category;
    for (let n = 1; n <= 3; n += 1) {
      const diploma = (
        await admin.post<{ department: { id: number; semester: number } }>("/departments", {
          name: unique(`Auto Diploma ${n}`),
          code: unique(`AD${n}`),
          color: "#000",
          bg: "#fff",
          description: "d",
          head: "h",
          category: category.key,
        })
      ).data.department;
      diplomas.push(diploma);
      for (const c of ["X", "Y"]) {
        await admin.post("/courses", { departmentIds: [diploma.id], name: `Course ${c}`, code: unique(`AC${n}${c}`), creditHours: 3 });
      }
    }
    for (const batch of Object.values(batches)) {
      expect((await admin.post("/batches", batch)).status).toBe(201);
    }
  });

  afterAll(async () => {
    for (const diploma of diplomas) await admin.delete(`/departments/${diploma.id}`);
    for (const batch of Object.values(batches)) await admin.delete(`/batches/${encodeURIComponent(batch.name)}`);
    if (category) await admin.delete(`/programme-categories/${category.id}`);
    await prisma.$disconnect();
  });

  it("offers a running batch every course of its term's diploma, in Sections A and B", async () => {
    const result = await offerTermDiplomas(fall, null, { category: category.key });
    expect(result.count).toBe(4); // 2 courses x Sections A and B
    expect(result.message).toMatch(/^4 course sections offered across 1 batch diploma\.$/);

    const offered = await offeredTo(batches.running.name);
    const third = diplomas.find((d) => d.semester === 3)!;
    expect(offered).toHaveLength(4);
    expect(offered.every((o) => o.section.departmentId === third.id)).toBe(true);
    expect(new Set(offered.map((o) => o.section.label))).toEqual(new Set(["A", "B"]));
  });

  it("skips batches that haven't started and batches that have graduated", async () => {
    expect(await offeredTo(batches.notStarted.name)).toHaveLength(0);
    expect(await offeredTo(batches.graduated.name)).toHaveLength(0);
  });

  it("never duplicates an offering, and offers nothing for Summer", async () => {
    const again = await offerTermDiplomas(fall, null, { category: category.key });
    expect(again.count).toBe(0);
    expect(again.message).toBe("Every batch already has its diploma's courses on offer.");

    const summer = await offerTermDiplomas({ semester: "SUMMER", year: year + 1 }, null, { category: category.key });
    expect(summer.count).toBe(0);
    expect(await offeredTo(batches.running.name)).toHaveLength(4);
  });

  it("doesn't offer courses when a student opens their registration page", async () => {
    const student = await signIn("student");
    const before = await prisma.sectionCourse.count();
    await student.get("/my/registration");
    expect(await prisma.sectionCourse.count()).toBe(before);
  });
});
