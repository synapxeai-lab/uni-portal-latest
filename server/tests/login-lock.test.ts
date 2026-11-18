import { beforeAll, describe, expect, it } from "vitest";

import { ApiSession, type ApiResponse, signIn, unique } from "./helpers/api";

const LOCK_AFTER = 8;

describe("account lock after wrong passwords", () => {
  let admin: ApiSession;
  let userId: string;
  let email: string;
  let password: string;

  const attempt = (pass: string) => new ApiSession().request("POST", "/auth/login", { email, password: pass });
  const messageOf = (res: ApiResponse) => (res.body as { message?: string }).message ?? "";

  beforeAll(async () => {
    admin = await signIn("admin");
    email = `${unique("lock")}@eithm.edu.pk`;
    const created = await admin.post<{ user: { id: string }; temporaryPassword: string }>("/admin/users", {
      name: "Lock Test",
      email,
      role: "STUDENT",
    });
    userId = created.data.user.id;
    password = created.data.temporaryPassword;
  });

  it("warns when few tries are left, then locks on the 8th and says so", async () => {
    for (let n = 1; n < LOCK_AFTER; n += 1) {
      const res = await attempt("Wrong@123");
      expect(res.status).toBe(401);
      const left = LOCK_AFTER - n;
      if (left <= 5) {
        expect(messageOf(res)).toContain(`${left} attempt${left === 1 ? "" : "s"} left`);
      } else {
        expect(messageOf(res)).toBe("Incorrect email or password.");
      }
    }

    const locking = await attempt("Wrong@123");
    expect(locking.status).toBe(403);
    expect(messageOf(locking)).toContain("Your account is locked");

    // Even the right password is refused while locked, with the same notice.
    const right = await attempt(password);
    expect(right.status).toBe(403);
    expect(messageOf(right)).toContain("Your account is locked");
  });

  it("unlocking starts the count afresh, so one typo doesn't lock it again", async () => {
    expect((await admin.post(`/admin/users/${userId}/status`, { status: "ACTIVE" })).status).toBe(200);

    const typo = await attempt("Wrong@123");
    expect(typo.status).toBe(401);
    expect(messageOf(typo)).toBe("Incorrect email or password.");

    expect((await attempt(password)).status).toBe(200);
  });

  it("never locks an admin, however many wrong passwords", async () => {
    const adminEmail = `${unique("lockadmin")}@eithm.edu.pk`;
    const created = await admin.post<{ temporaryPassword: string }>("/admin/users", {
      name: "Lock Test Admin",
      email: adminEmail,
      role: "ADMIN",
    });
    const tryAdmin = (pass: string) =>
      new ApiSession().request("POST", "/auth/login", { email: adminEmail, password: pass });

    for (let n = 0; n < LOCK_AFTER + 2; n += 1) {
      const res = await tryAdmin("Wrong@123");
      expect(res.status).toBe(401);
      expect(messageOf(res)).toBe("Incorrect email or password.");
    }
    expect((await tryAdmin(created.data.temporaryPassword)).status).toBe(200);
  });

  it("an unknown email never says locked or how many tries are left", async () => {
    const res = await new ApiSession().request("POST", "/auth/login", {
      email: `${unique("nobody")}@eithm.edu.pk`,
      password: "Wrong@123",
    });
    expect(res.status).toBe(401);
    expect(messageOf(res)).toBe("Incorrect email or password.");
  });
});
