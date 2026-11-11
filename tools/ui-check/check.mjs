// UI verification run inside the Playwright container (see docker-compose.yml):
//
//   docker compose run --rm ui-check                      # all roles, all pages
//   docker compose run --rm ui-check node check.mjs teacher /classes /todo
//
// For each role it signs in, then for every page and viewport (phone, tablet,
// desktop) it:
//   - saves a full-page screenshot to tools/ui-check/out/<role>/<viewport>/,
//   - records browser console errors and failed API calls,
//   - measures API latency of the page's requests (Server-Timing + wall time),
//   - detects horizontal overflow (layout wider than the viewport).
// On desktop it also hovers every sidebar link and fails if that sends any
// API request (hover must never prefetch).
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://client:5173";

const ACCOUNTS = {
  admin: { email: "admin@eithm.edu.pk", password: "Admin@12345" },
  teacher: { email: "ayesha.khan@eithm.edu.pk", password: "Teacher@123" },
  student: { email: "ali.raza@eithm.edu.pk", password: "Student@123" },
};

// "{classroomId}" / "{assignmentId}" are replaced with the seeded shared class and its first assignment.
const COMMON_PAGES = [
  "/dashboard",
  "/notifications",
  "/calendar",
  "/timetable",
  "/search?q=destination",
  "/profile",
  "/settings",
  "/classes",
  "/archived",
  "/classes/{classroomId}/stream",
  "/classes/{classroomId}/people",
  "/classes/{classroomId}/classwork",
  "/classes/{classroomId}/classwork/{assignmentId}",
  "/classes/{classroomId}/attendance",
  "/classes/{classroomId}/marks",
];
const DEFAULT_PAGES = {
  admin: [
    ...COMMON_PAGES,
    "/review",
    "/admin/users",
    "/admin/classrooms",
    "/admin/audit-logs",
    "/admin/timetable",
    "/admin/programmes",
    "/admin/programmes/{programmeSlug}",
    "/admin/diplomas/{departmentId}",
    "/admin/courses",
    "/admin/courses/{courseId}",
    "/admin/batches",
    "/admin/batches/{batch}",
    "/admin/sections/{sectionId}",
    "/admin/teachers",
    "/admin/students",
    "/admin/students/{academicStudentId}",
    "/admin/offerings",
    "/admin/offerings/{departmentId}/{batch}",
    "/admin/assign-teachers",
    "/admin/registration",
    "/admin/attendance",
    "/admin/grades",
    "/admin/fees",
    "/change-password",
  ],
  teacher: [
    ...COMMON_PAGES,
    "/review",
    "/classes/{classroomId}/classwork/{assignmentId}/submissions",
    "/classes/{classroomId}/classwork/{assignmentId}/submissions/{studentId}",
    "/grades",
    "/change-password",
  ],
  student: [...COMMON_PAGES, "/todo", "/my-courses", "/registration", "/my-attendance", "/my-marks", "/transcript", "/fee-challan"],
};

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

const [, , roleArg, ...pageArgs] = process.argv;
const roles = roleArg ? [roleArg] : Object.keys(ACCOUNTS);
const report = { problems: [], latency: [] };

function slug(path) {
  return path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_") || "root";
}

async function signIn(page, role) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", ACCOUNTS[role].email);
  await page.fill("#password", ACCOUNTS[role].password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
}

async function settle(page) {
  await page.waitForLoadState("networkidle");
  // Wait out skeletons and the 0.25s fade-in.
  await page.waitForTimeout(400);
}

for (const role of roles) {
  const pages = pageArgs.length > 0 ? pageArgs : DEFAULT_PAGES[role];
  const browser = await chromium.launch();

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const apiCalls = [];

    page.on("console", (message) => {
      // Over plain http on a non-localhost host (the production container
      // tested as http://app:4000) browsers ignore COOP and say so - not an app error.
      if (message.type() === "error" && !message.text().includes("Cross-Origin-Opener-Policy"))
        consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("requestfinished", async (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) return;
      const response = await request.response();
      const timing = request.timing();
      const serverTiming = response?.headers()["server-timing"]?.match(/dur=([\d.]+)/)?.[1];
      apiCalls.push({
        path: url.pathname + url.search,
        status: response?.status(),
        wallMs: Math.round(timing.responseEnd),
        serverMs: serverTiming ? Number(serverTiming) : null,
      });
    });

    await signIn(page, role);
    const classrooms = await page.evaluate(() => fetch("/api/classrooms").then((r) => r.json()));
    // The seeded class every demo account belongs to, and its first assignment.
    const classroom =
      classrooms.find((c) => c.title === "Advanced Mathematics 101") ?? classrooms[0];
    const classwork = classroom
      ? await page.evaluate(
          (id) => fetch(`/api/classrooms/${id}/classwork`).then((r) => r.json()),
          classroom.id,
        )
      : { assignments: [] };
    const ids = {
      classroomId: classroom?.id ?? "none",
      assignmentId: classwork.assignments[0]?.id ?? "none",
      studentId: "none",
    };
    if (role === "teacher" && ids.assignmentId !== "none") {
      const submissions = await page.evaluate(
        ({ classroomId, assignmentId }) =>
          fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/submissions`).then(
            (r) => r.json(),
          ),
        ids,
      );
      ids.studentId = submissions.overview?.rows?.[0]?.studentId ?? "none";
    }
    if (role === "admin") {
      // University records for the admin pages: the first diploma with a section.
      const uni = await page.evaluate(async () => {
        const get = (url) => fetch(url).then((r) => r.json());
        const [{ categories }, { departments }, { students }] = await Promise.all([
          get("/api/programme-categories"),
          get("/api/departments"),
          get("/api/students"),
        ]);
        const department = departments.find((d) => d.sections.length && d.courses.length) ?? departments[0];
        const section = department?.sections[0];
        return {
          programmeSlug: categories.find((c) => c.key === department?.category)?.slug ?? "none",
          departmentId: department?.id ?? "none",
          courseId: department?.courses[0]?.id ?? "none",
          sectionId: section?.id ?? "none",
          batch: section ? encodeURIComponent(section.batch) : "none",
          academicStudentId: students[0]?.id ?? "none",
        };
      });
      Object.assign(ids, uni);
    }
    mkdirSync(`out/${role}/${viewportName}`, { recursive: true });

    for (const template of pages) {
      const path = template.replace(/\{(\w+)\}/g, (_, name) => ids[name]);
      if (path.includes("/none")) continue; // nothing of that kind for this role
      apiCalls.length = 0;
      consoleErrors.length = 0;
      await page.goto(`${BASE_URL}${path}`);
      await settle(page);

      await page.screenshot({
        path: `out/${role}/${viewportName}/${slug(template)}.png`,
        fullPage: true,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) {
        report.problems.push(`${role} ${viewportName} ${path}: horizontal overflow ${overflow}px`);
      }
      for (const error of consoleErrors) {
        report.problems.push(`${role} ${viewportName} ${path}: console error: ${error}`);
      }
      for (const call of apiCalls) {
        if (call.status >= 500 || call.status === 404) {
          report.problems.push(`${role} ${viewportName} ${path}: ${call.status} ${call.path}`);
        }
        report.latency.push({ role, page: path, ...call });
      }
    }

    // Hovering sidebar links must not fire any API request.
    if (viewportName === "desktop") {
      await page.goto(`${BASE_URL}/dashboard`);
      await settle(page);
      apiCalls.length = 0;
      const links = page.locator("aside nav a");
      const count = await links.count();
      for (let index = 0; index < count; index += 1) {
        await links.nth(index).hover();
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(500);
      const hoverCalls = apiCalls.filter((call) => !call.path.includes("unread-count"));
      if (hoverCalls.length > 0) {
        report.problems.push(
          `${role}: hovering ${count} sidebar links fired API requests: ${hoverCalls.map((c) => c.path).join(", ")}`,
        );
      } else {
        console.log(`${role}: hovered ${count} sidebar links - no API requests`);
      }
    }

    await context.close();
  }

  await browser.close();
}

const slow = report.latency.filter((call) => (call.serverMs ?? 0) > 100);
console.log("\nAPI calls (server ms / wall ms):");
for (const call of report.latency) {
  console.log(
    `  ${call.role.padEnd(7)} ${call.page.padEnd(28)} ${String(call.status).padEnd(4)} ${String(call.serverMs).padStart(6)} / ${String(call.wallMs).padStart(4)}  ${call.path}`,
  );
}
writeFileSync("out/report.json", JSON.stringify(report, null, 2));

if (slow.length > 0) {
  report.problems.push(
    ...slow.map((call) => `slow (${call.serverMs}ms): ${call.page} ${call.path}`),
  );
}
if (report.problems.length > 0) {
  console.log("\nPROBLEMS:");
  for (const problem of report.problems) console.log(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed.");
}
