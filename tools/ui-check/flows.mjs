// End-to-end user flows through the real UI (Playwright, inside Docker):
//
//   docker compose run --rm ui-check node flows.mjs            # all flows
//   docker compose run --rm ui-check node flows.mjs stream     # one flow
//
// Each flow drives the browser like a user and asserts on what the page
// shows, so it exercises the client forms, the API and the cache refresh
// together. Flows clean up the content they create.
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://client:5173";

const ACCOUNTS = {
  admin: { email: "admin@eithm.edu.pk", password: "Admin@12345" },
  teacher: { email: "ayesha.khan@eithm.edu.pk", password: "Teacher@123" },
  student: { email: "ali.raza@eithm.edu.pk", password: "Student@123" },
};

async function signIn(browser, role, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", ACCOUNTS[role].email);
  await page.fill("#password", ACCOUNTS[role].password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
  return { context, page, errors };
}

async function firstClassroomId(page) {
  const classrooms = await page.evaluate(() => fetch("/api/classrooms").then((r) => r.json()));
  // The seeded class every demo account belongs to.
  return (classrooms.find((c) => c.title === "Advanced Mathematics 101") ?? classrooms[0]).id;
}

function expectVisible(locator, what) {
  // Responsive layouts render some content twice (one copy hidden by CSS).
  return locator
    .filter({ visible: true })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {
      throw new Error(`Expected to see ${what}`);
    });
}

const FLOWS = {
  /** Teacher posts, student comments, teacher sees the comment arrive live. */
  async stream(browser) {
    const stamp = Date.now();
    const text = `Flow announcement ${stamp}`;
    const teacher = await signIn(browser, "teacher");
    const classroomId = await firstClassroomId(teacher.page);
    await teacher.page.goto(`${BASE_URL}/classes/${classroomId}/stream`);

    await teacher.page.getByPlaceholder(/share something with your class/i).fill(text);
    await teacher.page.getByRole("button", { name: /^post$/i }).click();
    await expectVisible(
      teacher.page.getByText(text),
      "the new announcement in the teacher's stream",
    );

    const student = await signIn(browser, "student", { width: 390, height: 844 });
    await student.page.goto(`${BASE_URL}/classes/${classroomId}/stream`);
    const card = student.page.locator("[id^=announcement-]").filter({ hasText: text });
    await expectVisible(card, "the announcement in the student's stream");
    const comment = `Flow comment ${stamp}`;
    await card.getByPlaceholder(/add class comment/i).fill(comment);
    await card.getByRole("button", { name: /post comment/i }).click();
    await expectVisible(student.page.getByText(comment), "the student's own comment");

    // Live update: the teacher's open stream picks the comment up by polling.
    await expectVisible(
      teacher.page.getByText(comment),
      "the comment appearing live for the teacher",
    );

    // Clean up through the API.
    await teacher.page.evaluate(
      async ({ classroomId, text }) => {
        const list = await fetch(`/api/classrooms/${classroomId}/stream`).then((r) => r.json());
        const item = list.find((announcement) => announcement.content === text);
        if (item) {
          await fetch(`/api/classrooms/${classroomId}/announcements/${item.id}`, {
            method: "DELETE",
            headers: { "X-Requested-With": "portal" },
          });
        }
      },
      { classroomId, text },
    );

    for (const session of [teacher, student]) {
      if (session.errors.length) throw new Error(`Page errors: ${session.errors.join("; ")}`);
      await session.context.close();
    }
  },
};

FLOWS.classwork = async function classwork(browser) {
  const stamp = Date.now();
  const title = `Flow assignment ${stamp}`;
  const teacher = await signIn(browser, "teacher");
  const classroomId = await firstClassroomId(teacher.page);
  await teacher.page.goto(`${BASE_URL}/classes/${classroomId}/classwork`);

  // Create through the real dialog (multipart form, publish controls).
  await teacher.page.getByRole("button", { name: /create/i }).click();
  await teacher.page.getByRole("menuitem", { name: /assignment/i }).click();
  const dialog = teacher.page.getByRole("dialog");
  await dialog.locator("#assignment-title").fill(title);
  await dialog
    .getByRole("button", { name: /^assign$/i })
    .last()
    .click();
  await expectVisible(
    teacher.page.getByRole("link", { name: title }),
    "the new assignment in Classwork",
  );

  // Open it - the detail page loads from the list's link.
  await teacher.page.getByRole("link", { name: title }).click();
  await expectVisible(
    teacher.page.getByRole("heading", { name: title }),
    "the assignment detail page",
  );

  // A student sees it on a phone.
  const student = await signIn(browser, "student", { width: 390, height: 844 });
  await student.page.goto(`${BASE_URL}/classes/${classroomId}/classwork`);
  await expectVisible(student.page.getByText(title), "the assignment in the student's Classwork");

  await teacher.page.evaluate(
    async ({ classroomId, title }) => {
      const { assignments } = await fetch(`/api/classrooms/${classroomId}/classwork`).then((r) =>
        r.json(),
      );
      const item = assignments.find((assignment) => assignment.title === title);
      if (item) {
        await fetch(`/api/classrooms/${classroomId}/assignments/${item.id}`, {
          method: "DELETE",
          headers: { "X-Requested-With": "portal" },
        });
      }
    },
    { classroomId, title },
  );

  for (const session of [teacher, student]) {
    if (session.errors.length) throw new Error(`Page errors: ${session.errors.join("; ")}`);
    await session.context.close();
  }
};

FLOWS.submissions = async function submissions(browser) {
  const stamp = Date.now();
  const title = `Flow submission ${stamp}`;
  const teacher = await signIn(browser, "teacher");
  const classroomId = await firstClassroomId(teacher.page);
  const assignmentId = await teacher.page.evaluate(
    async ({ classroomId, title }) => {
      const form = new FormData();
      form.set("title", title);
      form.set("points", "20");
      form.set("status", "PUBLISHED");
      form.set("dueDate", new Date(Date.now() + 3 * 86_400_000).toISOString());
      const response = await fetch(`/api/classrooms/${classroomId}/assignments`, {
        method: "POST",
        headers: { "X-Requested-With": "portal" },
        body: form,
      });
      return (await response.json()).data.id;
    },
    { classroomId, title },
  );
  const assignmentUrl = `${BASE_URL}/classes/${classroomId}/classwork/${assignmentId}`;

  // Student turns in work from a phone.
  const student = await signIn(browser, "student", { width: 390, height: 844 });
  const studentId = await student.page.evaluate(() =>
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => s.user.id),
  );
  await student.page.goto(assignmentUrl);
  await student.page.getByPlaceholder(/type your response/i).fill("My flow answer");
  await student.page.getByRole("button", { name: /^turn in$/i }).click();
  await student.page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^turn in$/i })
    .click();
  await expectVisible(
    student.page.getByRole("button", { name: /unsubmit/i }),
    "Unsubmit after turning in",
  );

  // Teacher grades and returns it on a tablet-width review page.
  await teacher.page.setViewportSize({ width: 820, height: 1180 });
  await teacher.page.goto(`${assignmentUrl}/submissions/${studentId}`);
  await expectVisible(
    teacher.page.getByText("My flow answer"),
    "the student's answer on the review page",
  );
  await teacher.page.locator("#grade-input").fill("15");
  await teacher.page.locator("#feedback-input").fill("Nice work");
  await teacher.page.getByRole("button", { name: /save grade/i }).click();
  await expectVisible(teacher.page.getByRole("button", { name: /^return$/i }), "the Return button");
  await teacher.page.getByRole("button", { name: /^return$/i }).click();
  await teacher.page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^return$/i })
    .click();
  await expectVisible(teacher.page.getByText(/returned/i), "the Returned state");

  // The student sees the returned grade and feedback.
  await student.page.goto(assignmentUrl);
  await expectVisible(
    student.page.getByText("Nice work"),
    "the teacher's feedback for the student",
  );

  await teacher.page.evaluate(
    async ({ classroomId, assignmentId }) => {
      await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "portal" },
      });
    },
    { classroomId, assignmentId },
  );

  for (const session of [teacher, student]) {
    if (session.errors.length) throw new Error(`Page errors: ${session.errors.join("; ")}`);
    await session.context.close();
  }
};

FLOWS.notifications = async function notifications(browser) {
  // Make sure the student has something unread: the teacher posts to the class.
  const teacher = await signIn(browser, "teacher");
  const classroomId = await firstClassroomId(teacher.page);
  const text = `Flow notification ${Date.now()}`;
  await teacher.page.evaluate(
    async ({ classroomId, text }) => {
      const form = new FormData();
      form.set("content", text);
      form.set("status", "PUBLISHED");
      await fetch(`/api/classrooms/${classroomId}/announcements`, {
        method: "POST",
        headers: { "X-Requested-With": "portal" },
        body: form,
      });
    },
    { classroomId, text },
  );

  const student = await signIn(browser, "student", { width: 390, height: 844 });
  const bell = student.page.getByRole("button", { name: /notifications, \d+ unread/i });
  await expectVisible(bell, "the bell with an unread badge");
  await bell.click();
  await expectVisible(
    student.page.getByText(/new announcement/i),
    "the announcement in the bell menu",
  );
  await student.page.getByRole("link", { name: /view all notifications/i }).click();
  await student.page.waitForURL("**/notifications");
  await expectVisible(
    student.page.getByRole("button", { name: /^notifications$/i }),
    "the bell with no unread badge after opening Notifications",
  );

  await teacher.page.evaluate(
    async ({ classroomId, text }) => {
      const list = await fetch(`/api/classrooms/${classroomId}/stream`).then((r) => r.json());
      const item = list.find((announcement) => announcement.content === text);
      if (item) {
        await fetch(`/api/classrooms/${classroomId}/announcements/${item.id}`, {
          method: "DELETE",
          headers: { "X-Requested-With": "portal" },
        });
      }
    },
    { classroomId, text },
  );

  for (const session of [teacher, student]) {
    if (session.errors.length) throw new Error(`Page errors: ${session.errors.join("; ")}`);
    await session.context.close();
  }
};

FLOWS.timetable = async function timetable(browser) {
  const teacher = await signIn(browser, "teacher");
  await teacher.page.goto(`${BASE_URL}/timetable`);
  await teacher.page.getByRole("button", { name: /add a class/i }).click();
  const dialog = teacher.page.getByRole("dialog");
  await dialog.locator("#timetable-classroom").selectOption(await firstClassroomId(teacher.page));
  // Friday, first free hour (availability loads per day from the API).
  await dialog.getByRole("radiogroup", { name: "Day" }).getByRole("radio").nth(4).click();
  const freeHour = dialog
    .getByRole("radiogroup", { name: "Time slot" })
    .getByRole("radio")
    .and(teacher.page.locator(":not([disabled])"))
    .first();
  await freeHour.waitFor({ state: "visible", timeout: 10_000 });
  await freeHour.click();
  await dialog.locator("#timetable-room").fill("305");
  await dialog
    .getByRole("button", { name: /schedule|save/i })
    .last()
    .click();
  await expectVisible(
    teacher.page.getByText("Room 305"),
    "the new class on the teacher's timetable",
  );

  // The student sees it on their own (phone-sized) timetable.
  const student = await signIn(browser, "student", { width: 390, height: 844 });
  await student.page.goto(`${BASE_URL}/timetable`);
  await expectVisible(student.page.getByText("Room 305"), "the class on the student's timetable");

  // Clean up through the API.
  await teacher.page.evaluate(async () => {
    const { slots } = await fetch("/api/timetable").then((r) => r.json());
    for (const slot of slots.filter((s) => s.room === "305")) {
      await fetch(`/api/timetable/slots/${slot.id}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "portal" },
      });
    }
  });

  for (const session of [teacher, student]) {
    if (session.errors.length) throw new Error(`Page errors: ${session.errors.join("; ")}`);
    await session.context.close();
  }
};

FLOWS.search = async function search(browser) {
  const student = await signIn(browser, "student");
  await expectVisible(
    student.page.getByRole("button", { name: /search classes, people, and files/i }),
    "the header search bar",
  );
  // Global shortcut opens the dialog from anywhere; results are debounced fetches.
  await student.page.keyboard.press("Control+k");
  const input = student.page.getByRole("dialog").getByPlaceholder(/search classes, announcements/i);
  await input.fill("destination");
  await expectVisible(
    student.page.getByRole("dialog").getByText("Destination profile").first(),
    "a search result in the Ctrl+K dialog",
  );
  await input.press("Enter");
  await student.page.waitForURL("**/search?q=destination**");
  await expectVisible(student.page.getByText(/results for "destination"/i), "the search results page");
  if (student.errors.length) throw new Error(`Page errors: ${student.errors.join("; ")}`);
  await student.context.close();
};

FLOWS.settings = async function settings(browser) {
  const admin = await signIn(browser, "admin");
  await admin.page.goto(`${BASE_URL}/settings#platform`);
  // Saving with an unchecked box ("Require symbol" is off by default).
  await admin.page.getByRole("button", { name: /save settings/i }).click();
  await expectVisible(admin.page.getByText("Settings saved."), "the saved toast");
  if (admin.errors.length) throw new Error(`Page errors: ${admin.errors.join("; ")}`);
  await admin.context.close();
};

FLOWS.avatar = async function avatar(browser) {
  const student = await signIn(browser, "student", { width: 390, height: 844 });
  await student.page.goto(`${BASE_URL}/profile`);
  // A 1x1 PNG.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await student.page
    .locator("#avatar")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await student.page.getByRole("button", { name: /save photo/i }).click();
  await expectVisible(student.page.getByText("Profile photo updated"), "the success toast");
  // The header avatar now points at the uploaded photo (versioned URL).
  await student.page
    .locator('header img[src^="/api/avatars/"]')
    .first()
    .waitFor({ state: "attached", timeout: 10_000 });
  if (student.errors.length) throw new Error(`Page errors: ${student.errors.join("; ")}`);
  await student.context.close();
};

FLOWS.adminUsers = async function adminUsers(browser) {
  const stamp = Date.now();
  const email = `flow.${stamp}@eithm.edu.pk`;
  const name = `Flow User ${stamp}`;
  const admin = await signIn(browser, "admin");
  await admin.page.goto(`${BASE_URL}/admin/users`);

  // Create through the dialog; the temporary password dialog follows.
  await admin.page.getByRole("button", { name: /create user/i }).click();
  const dialog = admin.page.getByRole("dialog");
  await dialog.locator("#name").fill(name);
  await dialog.locator("#email").fill(email);
  await dialog.getByRole("button", { name: /^create user$/i }).click();
  await expectVisible(admin.page.getByText("Temporary password"), "the temporary password dialog");
  await admin.page.keyboard.press("Escape");

  // Find the new user via the table search, then deactivate them.
  await admin.page.goto(`${BASE_URL}/admin/users?q=${encodeURIComponent(email)}`);
  await expectVisible(admin.page.getByText(email), "the new user in the table");
  await admin.page
    .getByRole("button", { name: `Actions for ${name}` })
    .first()
    .click();
  await admin.page.getByRole("menuitem", { name: /deactivate/i }).click();
  await admin.page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^deactivate$/i })
    .click();
  await expectVisible(admin.page.getByText(/inactive/i), "the Inactive status badge");

  // The audit log recorded the creation.
  await admin.page.goto(`${BASE_URL}/admin/audit-logs?q=${encodeURIComponent(email)}`);
  await expectVisible(admin.page.getByText(/user created/i), "the User Created audit event");

  if (admin.errors.length) throw new Error(`Page errors: ${admin.errors.join("; ")}`);
  await admin.context.close();
};

const selected = process.argv.slice(2);
const names = selected.length > 0 ? selected : Object.keys(FLOWS);
const browser = await chromium.launch();
let failed = 0;

for (const name of names) {
  const started = Date.now();
  try {
    await FLOWS[name](browser);
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

await browser.close();
process.exitCode = failed > 0 ? 1 : 0;
