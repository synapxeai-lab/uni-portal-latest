/**
 * A signed-in API client for the API tests. Talks to the running dev server
 * (inside the container: http://localhost:4000/api) with the session cookie
 * and CSRF header the browser would send.
 */
export const API_BASE = process.env.TEST_API_BASE_URL ?? "http://localhost:4000/api";

/** Seed accounts (prisma/seed.ts). */
export const ACCOUNTS = {
  admin: { email: "admin@eithm.edu.pk", password: "Admin@12345" },
  teacher: { email: "ayesha.khan@eithm.edu.pk", password: "Teacher@123" },
  student: { email: "ali.raza@eithm.edu.pk", password: "Student@123" },
} as const;

export interface ApiResponse<T = unknown> {
  status: number;
  body: { status: "success"; data: T } | { status: "error"; message: string; code?: string };
  /** `data` of a success body; throws on an error body. */
  data: T;
}

export class ApiSession {
  private cookie = "";

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { "X-Requested-With": "portal" };
    if (this.cookie) {
      headers.Cookie = this.cookie;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    return {
      status: response.status,
      body: parsed,
      // Reads return their payload as-is; mutations wrap it as { status, data }.
      get data() {
        if (!response.ok || parsed.status === "error") {
          throw new Error(`${method} ${path} -> ${response.status}: ${parsed.message ?? text}`);
        }
        return (parsed.status === "success" ? parsed.data : parsed) as T;
      },
    };
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body ?? {});
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body ?? {});
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body ?? {});
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }

  async login(email: string, password: string) {
    const response = await this.post("/auth/login", { email, password });
    if (response.status !== 200) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(response.body)}`);
    }
    return this;
  }
}

export function signIn(role: keyof typeof ACCOUNTS): Promise<ApiSession> {
  const { email, password } = ACCOUNTS[role];
  return new ApiSession().login(email, password);
}

/** A string unique to this test run, for names that must not collide. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
