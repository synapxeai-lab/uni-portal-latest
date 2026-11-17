import { beforeAll, describe, expect, it } from "vitest";

import { type ApiSession, signIn } from "./helpers/api";

interface NotificationPage {
  notifications: { id: string }[];
  nextCursor: string | null;
}

describe("clear all notifications", () => {
  let student: ApiSession;
  let teacher: ApiSession;

  beforeAll(async () => {
    student = await signIn("student");
    teacher = await signIn("teacher");
  });

  it("clears every one of the caller's notifications and nobody else's", async () => {
    const teacherBefore = (await teacher.get<NotificationPage>("/notifications?limit=50")).data.notifications;

    const cleared = await student.delete<{ deleted: number }>("/notifications");
    expect(cleared.status).toBe(200);
    expect(typeof cleared.data.deleted).toBe("number");

    const after = (await student.get<NotificationPage>("/notifications")).data;
    expect(after.notifications).toEqual([]);
    expect(after.nextCursor).toBeNull();
    expect((await student.get<{ count: number }>("/notifications/unread-count")).data.count).toBe(0);

    const teacherAfter = (await teacher.get<NotificationPage>("/notifications?limit=50")).data.notifications;
    expect(teacherAfter.map((n) => n.id)).toEqual(teacherBefore.map((n) => n.id));

    // Clearing an empty list is fine too.
    expect((await student.delete<{ deleted: number }>("/notifications")).data.deleted).toBe(0);
  });
});
