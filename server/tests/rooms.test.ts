import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ApiSession, signIn } from "./helpers/api";

interface RoomRow {
  id: string;
  number: string;
  floor: number;
  isActive: boolean;
  weeklyClasses: number;
}

describe("rooms", () => {
  let admin: ApiSession;
  let teacher: ApiSession;
  let created: RoomRow | undefined;
  let number: string;

  const list = async () => (await admin.get<{ rooms: RoomRow[] }>("/admin/rooms")).data.rooms;

  beforeAll(async () => {
    admin = await signIn("admin");
    teacher = await signIn("teacher");
    // A floor-9 number no real room uses.
    const taken = new Set((await list()).map((r) => r.number));
    number = Array.from({ length: 100 }, (_, i) => `9${String(i).padStart(2, "0")}`).find((n) => !taken.has(n))!;
  });

  afterAll(async () => {
    if (created) await admin.delete(`/admin/rooms/${created.id}`);
  });

  it("adds a 3-digit room with its floor and refuses bad or repeated numbers", async () => {
    expect((await admin.post("/admin/rooms", { number: "12" })).status).toBe(400);
    expect((await admin.post("/admin/rooms", { number: "12a" })).status).toBe(400);

    const res = await admin.post<{ room: RoomRow }>("/admin/rooms", { number });
    expect(res.status).toBe(201);
    created = res.data.room;
    expect(created).toMatchObject({ number, floor: 9, isActive: true, weeklyClasses: 0 });

    expect((await admin.post("/admin/rooms", { number })).status).toBe(409);
  });

  it("shows the room on the timetable while it's in use", async () => {
    const rooms = async () => (await teacher.get<{ rooms: string[] }>("/timetable")).data.rooms;
    expect(await rooms()).toContain(number);

    expect((await admin.post(`/admin/rooms/${created!.id}/status`, { isActive: false })).status).toBe(200);
    expect(await rooms()).not.toContain(number);

    expect((await admin.post(`/admin/rooms/${created!.id}/status`, { isActive: true })).status).toBe(200);
    expect(await rooms()).toContain(number);
  });

  it("won't take a booked room out of use or delete it", async () => {
    const booked = (await list()).find((r) => r.weeklyClasses > 0);
    if (!booked) return; // no class booked anywhere on this database
    expect((await admin.post(`/admin/rooms/${booked.id}/status`, { isActive: false })).status).toBe(400);
    expect((await admin.delete(`/admin/rooms/${booked.id}`)).status).toBe(400);
  });

  it("deletes a room that was never booked", async () => {
    expect((await admin.delete(`/admin/rooms/${created!.id}`)).status).toBe(200);
    expect((await list()).some((r) => r.number === number)).toBe(false);
    created = undefined;
  });

  it("is for admins only", async () => {
    expect((await teacher.get("/admin/rooms")).status).toBe(403);
    expect((await teacher.post("/admin/rooms", { number: "999" })).status).toBe(403);
  });
});
