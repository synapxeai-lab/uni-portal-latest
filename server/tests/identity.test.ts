import { describe, expect, it } from "vitest";

import { decryptPassword, encryptPassword } from "@/lib/auth/password-vault";

import { ACCOUNTS, ApiSession, signIn, unique } from "./helpers/api";

interface UserRow {
  id: string;
  email: string;
  role: string;
  hasViewablePassword: boolean;
}

describe("password vault", () => {
  it("round-trips a password", () => {
    const stored = encryptPassword("S3cret!pass");
    expect(stored.split(".")).toHaveLength(3);
    expect(decryptPassword(stored)).toBe("S3cret!pass");
  });

  it("returns null for missing or tampered values", () => {
    expect(decryptPassword(null)).toBeNull();
    const [iv, tag] = encryptPassword("x").split(".");
    expect(decryptPassword(`${iv}.${tag}.AAAA`)).toBeNull();
  });
});

describe("unified sign-in", () => {
  it("signs in every role and reports the session user", async () => {
    for (const role of ["admin", "teacher", "student"] as const) {
      const session = await signIn(role);
      const me = await session.get<{ user: { email: string; role: string } }>("/auth/session");
      expect(me.data.user.email).toBe(ACCOUNTS[role].email);
      expect(me.data.user.role).toBe(role.toUpperCase());
    }
  });

  it("rejects a wrong password", async () => {
    const response = await new ApiSession().post("/auth/login", {
      email: ACCOUNTS.teacher.email,
      password: "not-the-password",
    });
    expect(response.status).toBe(401);
  });

  it("blocks non-admins from the admin console", async () => {
    const student = await signIn("student");
    expect((await student.get("/admin/users")).status).toBe(403);
  });
});

describe("admin-viewable passwords", () => {
  it("shows a new user's temporary password, then their own after they change it", async () => {
    const admin = await signIn("admin");
    const email = `${unique("viewpw")}@eithm.edu.pk`;

    const created = await admin.post<{ user: UserRow; temporaryPassword: string }>("/admin/users", {
      name: "View Password Test",
      email,
      role: "STUDENT",
    });
    const { user, temporaryPassword } = created.data;
    expect(user.hasViewablePassword).toBe(true);

    const viewed = await admin.get<{ password: string }>(`/admin/users/${user.id}/password`);
    expect(viewed.data.password).toBe(temporaryPassword);

    // The new user must change the temporary password first.
    const newcomer = await new ApiSession().login(email, temporaryPassword);
    expect((await newcomer.get("/dashboard")).status).toBe(403);
    const changed = await newcomer.post("/account/password", {
      currentPassword: temporaryPassword,
      newPassword: "MyOwnPass1",
      confirmPassword: "MyOwnPass1",
    });
    expect(changed.status).toBe(200);

    const afterChange = await admin.get<{ password: string }>(`/admin/users/${user.id}/password`);
    expect(afterChange.data.password).toBe("MyOwnPass1");

    // Archive the test account so it doesn't clutter the users list.
    await admin.post(`/admin/users/${user.id}/status`, { status: "ARCHIVED" });
  });

  it("is admin-only", async () => {
    const admin = await signIn("admin");
    const users = await admin.get<{ users: UserRow[] }>(
      `/admin/users?q=${encodeURIComponent(ACCOUNTS.student.email)}`,
    );
    const student = users.data.users[0];
    const teacher = await signIn("teacher");
    expect((await teacher.get(`/admin/users/${student.id}/password`)).status).toBe(403);
  });
});
