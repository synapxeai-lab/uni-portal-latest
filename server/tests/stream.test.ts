import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ApiSession, signIn, unique } from "./helpers/api";

interface StreamClassworkItem {
  kind: "ASSIGNMENT" | "MATERIAL";
  id: string;
  title: string;
  dueDate: string | null;
  points: number | null;
  author: { name: string };
}

describe("classwork in the stream", () => {
  let teacher: ApiSession;
  let classroomId: string;
  let assignmentId: string | undefined;
  const title = unique("Stream assignment (test)");

  const streamClasswork = async () =>
    (await teacher.get<StreamClassworkItem[]>(`/classrooms/${classroomId}/stream/classwork`)).data;
  const version = async () =>
    (await teacher.get<{ version: string }>(`/classrooms/${classroomId}/stream/version`)).data.version;

  beforeAll(async () => {
    teacher = await signIn("teacher");
    const grades = await teacher.get<{ offerings: { classroomId: string | null }[] }>("/grades");
    classroomId = grades.data.offerings.find((o) => o.classroomId)!.classroomId!;
  });

  afterAll(async () => {
    if (assignmentId) await teacher.delete(`/classrooms/${classroomId}/assignments/${assignmentId}`);
  });

  it("keeps a draft off the stream, even for the teacher", async () => {
    const before = await version();
    const created = await teacher.post<{ id: string }>(`/classrooms/${classroomId}/assignments`, {
      title,
      points: "10",
      status: "DRAFT",
    });
    expect(created.status).toBe(201);
    assignmentId = created.data.id;
    expect((await streamClasswork()).some((i) => i.id === assignmentId)).toBe(false);
    // Open stream pages still refresh: the version moves with classwork.
    expect(await version()).not.toBe(before);
  });

  it("posts published work to the stream and takes it off when deleted", async () => {
    const published = await teacher.post(`/scheduling/assignment/${assignmentId}/publish`);
    expect(published.status).toBe(200);
    const item = (await streamClasswork()).find((i) => i.id === assignmentId);
    expect(item).toMatchObject({ kind: "ASSIGNMENT", title, points: 10 });

    expect((await teacher.delete(`/classrooms/${classroomId}/assignments/${assignmentId}`)).status).toBe(200);
    expect((await streamClasswork()).some((i) => i.id === assignmentId)).toBe(false);
    assignmentId = undefined;
  });
});
