/**
 * API latency report for the page-load endpoints.
 *
 *   docker compose exec server npm run latency
 *
 * Signs in as each seeded role and requests every page-load endpoint
 * repeatedly, both straight from the database (X-Cache-Bypass, i.e. a cold
 * cache) and warm. Prints median / p95 / max per endpoint and exits non-zero
 * when a median exceeds the budget (BUDGET_MS, default 100ms; target ~80ms).
 * The first round per endpoint is a warm-up and is not counted (Prisma
 * compiles each query shape once per process).
 */

const BASE = process.env.LATENCY_BASE_URL ?? "http://localhost:4000/api";
const ROUNDS = Number(process.env.LATENCY_ROUNDS ?? 10);
const BUDGET_MS = Number(process.env.BUDGET_MS ?? 100);

const ACCOUNTS = {
  admin: { email: "admin@eithm.edu.pk", password: "Admin@12345" },
  teacher: { email: "ayesha.khan@eithm.edu.pk", password: "Teacher@123" },
  student: { email: "ali.raza@eithm.edu.pk", password: "Student@123" },
} as const;

type Role = keyof typeof ACCOUNTS;

interface Context {
  classroomId?: string;
  assignmentId?: string;
  studentId?: string;
}

/** The Calendar page's request for the current month (ranges as the browser computes them). */
function calendarPath(): string {
  const now = new Date();
  const day = (offset: number, end = false) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
    return date.toISOString();
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - 7);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + 7);
  const params = new URLSearchParams({
    gridStart: gridStart.toISOString(),
    gridEnd: gridEnd.toISOString(),
    todayStart: day(0),
    todayEnd: day(0, true),
    upcomingStart: day(1),
    upcomingEnd: day(14, true),
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
  });
  return `/calendar?${params.toString()}`;
}

/** Page-load endpoints per role. Extended as each module is migrated. */
function endpointsFor(role: Role, ctx: Context): string[] {
  const endpoints = [
    "/auth/session",
    "/notifications/unread-count",
    "/classrooms",
    "/classrooms/archived",
    "/dashboard",
    "/notifications?limit=20",
    ...(role === "student" ? ["/todo"] : ["/review"]),
    "/timetable",
    "/search?q=geometry",
    "/account/profile",
    ...(role === "admin"
      ? ["/admin/settings", "/admin/users", "/admin/classrooms", "/admin/audit-logs"]
      : []),
    calendarPath(),
    ...(role === "admin" ? ["/timetable/clashes"] : []),
  ];
  if (ctx.classroomId) {
    endpoints.push(
      `/classrooms/${ctx.classroomId}`,
      `/classrooms/${ctx.classroomId}/people`,
      `/classrooms/${ctx.classroomId}/stream`,
      `/classrooms/${ctx.classroomId}/stream/version`,
      `/classrooms/${ctx.classroomId}/classwork`,
    );
    if (ctx.assignmentId) {
      const assignment = `/classrooms/${ctx.classroomId}/assignments/${ctx.assignmentId}`;
      endpoints.push(assignment, `${assignment}/submission-panel`);
      if (role === "teacher") {
        endpoints.push(`${assignment}/submissions`);
        if (ctx.studentId) {
          endpoints.push(`${assignment}/submissions/${ctx.studentId}`);
        }
      }
    }
  }
  return endpoints;
}

async function signIn(role: Role): Promise<string> {
  const response = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "portal" },
    body: JSON.stringify(ACCOUNTS[role]),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!response.ok || !cookie) {
    throw new Error(`Sign-in failed for ${role}: ${response.status}`);
  }
  return cookie;
}

async function timeRequest(path: string, cookie: string, bypass: boolean): Promise<number> {
  const start = performance.now();
  const response = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie, ...(bypass ? { "X-Cache-Bypass": "1" } : {}) },
  });
  await response.arrayBuffer();
  const elapsed = performance.now() - start;
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return elapsed;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function measure(path: string, cookie: string, bypass: boolean) {
  await timeRequest(path, cookie, bypass); // warm-up
  const samples: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    samples.push(await timeRequest(path, cookie, bypass));
  }
  samples.sort((a, b) => a - b);
  return { p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples.at(-1)! };
}

const fmt = (ms: number) => ms.toFixed(1).padStart(6);
const shortPath = (path: string) =>
  path
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")
    .replace(/^\/calendar\?.*/, "/calendar?<this month>");

let failures = 0;
console.log(`Budget: median <= ${BUDGET_MS}ms   (${ROUNDS} rounds per endpoint)\n`);
console.log(
  `${"role".padEnd(8)}${"endpoint".padEnd(60)}${"uncached p50/p95/max".padEnd(24)}cached p50/p95/max`,
);

for (const role of Object.keys(ACCOUNTS) as Role[]) {
  const cookie = await signIn(role);
  const getJson = async <T>(path: string): Promise<T> =>
    (await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } })).json() as Promise<T>;
  // The seeded class every demo account belongs to, and its first assignment.
  const classrooms = await getJson<{ id: string; title: string }[]>("/classrooms");
  const classroomId = (
    classrooms.find((c) => c.title === "Advanced Mathematics 101") ?? classrooms[0]
  )?.id;
  const classwork = classroomId
    ? await getJson<{ assignments: { id: string }[] }>(`/classrooms/${classroomId}/classwork`)
    : { assignments: [] };
  const ctx: Context = { classroomId, assignmentId: classwork.assignments[0]?.id };
  if (role === "teacher" && ctx.assignmentId) {
    const submissions = await getJson<{ overview?: { rows: { studentId: string }[] } }>(
      `/classrooms/${classroomId}/assignments/${ctx.assignmentId}/submissions`,
    );
    ctx.studentId = submissions.overview?.rows[0]?.studentId;
  }

  for (const path of endpointsFor(role, ctx)) {
    const cold = await measure(path, cookie, true);
    const warm = await measure(path, cookie, false);
    const over = cold.p50 > BUDGET_MS || warm.p50 > BUDGET_MS;
    if (over) failures += 1;
    console.log(
      `${role.padEnd(8)}${shortPath(path).padEnd(60)}${fmt(cold.p50)}${fmt(cold.p95)}${fmt(cold.max)}      ${fmt(warm.p50)}${fmt(warm.p95)}${fmt(warm.max)}${over ? "   OVER BUDGET" : ""}`,
    );
  }
}

if (failures > 0) {
  console.log(`\n${failures} endpoint(s) over budget.`);
  process.exitCode = 1;
} else {
  console.log("\nAll endpoints within budget.");
}

export {};
