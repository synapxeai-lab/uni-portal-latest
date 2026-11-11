# GCR - EITHM classroom platform

## Project Overview

GCR is a Google Classroom-inspired learning platform, branded for EITHM (Elevate Institute of Tourism & Hospitality Management). Teachers and students get classes with a Stream (announcements and comments), Classwork (topics, materials, assignments with drafts and scheduled publishing), submissions with grading and private comments, a cross-class review queue, a to-do board, a calendar, a weekly timetable, global search and notifications. Administrators get a console for users, classrooms, timetable clashes, audit logs and platform settings.

## Architecture

The application is split into a REST API and a single-page React app, in one npm-workspaces repository:

```
server/   Express 5 + TypeScript API, Prisma ORM, PostgreSQL
client/   React 19 + Vite + TypeScript SPA (React Router, TanStack Query, axios)
shared/   zod schemas, enums, API contract types and date helpers used by both
tools/    Playwright UI checks and end-to-end browser flows (run in Docker)
```

- **API** (`server/src`): feature-first, mirroring the client. Each `features/<name>/` folder holds `services/` (Prisma access and business rules), `validation/` (zod), `types` and a `<name>.routes.ts` Express router. Shared infrastructure lives in `lib/` (Prisma client, tagged cache, scheduling engine, storage, audit log), `middleware/` (auth, CSRF, timing, errors) and `http/` (validation, uploads, file streaming).
- **Client** (`client/src`): `pages/` (one lazily loaded chunk per route), `features/<name>/` (components plus an `api.ts` of TanStack Query hooks and mutation functions), shared UI in `components/`, and `app/` (routes, layouts, session gate).
- **Authentication**: email + password checked with bcrypt; a successful login issues an HS256 JWT in an httpOnly, SameSite=Lax cookie. Every login also creates a `UserLoginSession` row keyed by the token's `jti`, and every request re-checks that row and the account status, so signing out, an admin suspension or a forced password change takes effect on the very next request. Five consecutive failed logins lock the account.
- **Caching**: the API keeps an in-memory, tag-invalidated read cache (per viewer, 30-60s TTL); every mutation invalidates exactly the tags it affects, so the acting user never sees stale data. The client caches every page's data with TanStack Query (30s fresh, then stale-while-revalidate). Nothing is prefetched speculatively - hovering links (e.g. the sidebar) never sends a request.
- **Performance**: each page loads with one or two API calls. Every API response carries a `Server-Timing` header, requests slower than 100ms are logged, and the hot query plans are compiled at startup (`server/src/lib/warm-up.ts`). See [Performance](#performance).

The data model and the UI design system are documented in [docs/database-architecture.md](docs/database-architecture.md) and [docs/ui-architecture.md](docs/ui-architecture.md). (Those documents and [instructions.md](instructions.md) predate the move from Next.js; the data model and design system they describe are unchanged.)

## Technology Stack

- **API**: Node.js 22, Express 5, TypeScript (strict), Prisma 7 with the `pg` driver adapter, PostgreSQL 17, zod, jsonwebtoken + bcryptjs, multer (uploads), helmet, compression
- **Client**: React 19, Vite 7, React Router 7, TanStack Query 5, axios, react-hook-form, Tailwind CSS 4, Radix UI primitives (shadcn-style components), Lucide icons, Sonner toasts, self-hosted Rubik/Nunito fonts
- **Tooling**: Docker + Docker Compose (no Node.js needed on the host), esbuild (server bundle), Prettier, Playwright (UI checks)

## Prerequisites

- Docker Desktop (with Docker Compose v2)
- Git

Node.js is **not** required on your machine - installs, the API, the dev server and every script run in containers.

## Project Setup

1. Clone the repository and start the stack:
   ```bash
   docker compose up --build -d
   ```
   This starts PostgreSQL, installs dependencies into a Docker volume (the one-off `deps` service), applies migrations, and runs the API (`http://localhost:4000`) and the React dev server (`http://localhost:5173`), both with hot reload.
2. Load the demo data (first time only):
   ```bash
   docker compose exec server npm run seed
   ```
3. Open **http://localhost:5173** and sign in with a [seed account](#seed-accounts).

After changing dependencies in any `package.json`, re-run the installer: `docker compose run --rm deps`.

### Seed accounts

| Role    | Email                    | Password       |
| ------- | ------------------------ | -------------- |
| Admin   | `faizan.admin@gcr.dev`   | `F@izan4121`   |
| Teacher | `daniel.teacher@gcr.dev` | `Testpass123!` |
| Student | `sofia.student@gcr.dev`  | `Testpass123!` |
| Student | `liam.student@gcr.dev`   | `Testpass123!` |

The teacher owns "Advanced Mathematics 101"; both students are enrolled. The login page shows these accounts in development builds.

**Account lockout:** 5 consecutive failed sign-ins lock an account (`LOCKED`) until an admin sets it back to Active from `/admin/users`. There is no self-registration; every account is created by an administrator or by the seed.

## Trying It Out Locally

### User flow walkthrough

A step-by-step path through everything currently implemented. Useful for anyone reviewing the app for the first time.

**1. Authentication**

- Visit `/login`, sign in as the teacher (`daniel.teacher@gcr.dev`).
- Try a wrong password first if you want to see the inline error state.
- On success you land on `/dashboard`.
- Open an incognito window and try visiting `/dashboard` directly while signed out - you should be redirected to `/login` (the client session gate in `client/src/app/layouts.tsx`; the API independently answers 401 to every request without a live session).
- See [Dashboard Enhancements](#dashboard-enhancements) below for what `/dashboard` actually shows per role (it's role-specific, not the generic placeholder from earlier phases).

**2. Application shell**

- Click the hamburger icon (top-left) on desktop - the sidebar collapses to icon-only with hover tooltips; click again to expand.
- Shrink the browser window below ~1024px - the sidebar disappears and the same hamburger now opens a slide-in drawer.
- Click the bell icon - a real notifications dropdown backed by the `Notification` table (unread count badge, mark-as-read, links to the relevant classroom item).
- Click your avatar (top-right) - dropdown with your name/email/role and a working Sign out.

**3. Classroom list (`/classes`, via the sidebar)**

- As the teacher: you see the "Advanced Mathematics 101" card and both **Create class** and **Join class** buttons.
- Click the **⋮** menu on the card: Copy class code / Edit class / Archive class.
- Create a test class via the dialog - it redirects you straight into the new class.
- Sign out and sign in as the student (`sofia.student@gcr.dev`): same class card is visible (she's enrolled), but there's no **Create class** button - only **Join class** and, on the **⋮** menu, **Leave class** instead of Edit/Archive.
- Try joining with a made-up code to see the validation/not-found error.
- See [Archived Classroom Experience](#archived-classroom-experience) below for what changes once a class is archived.

**4. Classroom detail**

- Click into a class card. You land on a colored banner header with the class title/section and three tabs: **Stream / Classwork / People**.
- All three tabs are fully implemented (see sections 5-10 for Stream/Classwork; People shows the roster split into Teachers/Students with an Invite dialog, role changes, and remove-member, all authorized server-side).

**5. Stream - announcements**

- As the teacher, you'll see a composer at the top ("Share something with your class..."). Post one.
- As the student, there is no composer at all - confirm the textarea/Post button simply aren't in the page for a student account.
- On each announcement (teacher view), open the **⋮** menu: **Edit**, **Pin**/**Unpin**, **Delete**.
  - Pin one - it should jump to the top of the list regardless of when it was posted, and a "Pinned" badge appears (visible to every role, not just the teacher).
  - Edit one - content updates and an "· edited" marker appears next to the timestamp.
  - Delete one - a confirmation dialog appears first (destructive action); after confirming, it disappears and a toast confirms it.
- As the student, confirm the **⋮** menu doesn't appear on any announcement at all.

**6. Stream - comments**

- Under any announcement, both teacher and student can type in the "Add class comment…" box and post - it appears in the thread immediately (optimistic UI, before the server even responds).
- As a student, post a comment, then confirm you see a delete (trash) icon on _your own_ comment but not on other people's.
- As the teacher, confirm you see a delete icon on _every_ comment in the classroom, including students' - deleting one shows a toast and removes it instantly.
- Comments display oldest-first, growing downward like a conversation thread.

**7. Classwork - topics**

- As the teacher, open the **Classwork** tab and use **+ Create → Topic** to add one or two topics.
- Rename a topic inline, then drag-and-drop to reorder them - the order persists across a page refresh.
- Delete a topic - a confirmation dialog appears first.
- As the student, confirm the Classwork tab shows the same topics with no **+ Create** button and no rename/reorder/delete controls anywhere.

**8. Classwork - materials**

- As the teacher, use **+ Create → Material** and try each input type: a description-only note, a link (a YouTube/Vimeo URL is categorized as video, any other URL as a link), and a file attachment.
- Assign a material to a topic, and leave another unassigned - the unassigned one renders under a "General" group.
- Edit and delete a material - both work as expected, with a confirmation on delete.
- As the student, materials are visible but read-only (no edit/delete controls). Note that file attachments currently record metadata only (name/size/type) - actual file storage isn't wired up yet, and the UI says so explicitly.

**9. Classwork - assignments**

- As the teacher, use **+ Create → Assignment**, fill in title/instructions/due date/points/topic/attachments, and click **Save draft** - it appears in the list with a **Draft** badge, visible only to you.
- As the student, confirm the draft assignment does not appear in the Classwork list at all.
- Back as the teacher, open the assignment's management menu and **Publish now** - the student now sees it (no badge).
- Try **Close assignment**, **Edit**, and **Delete** from the same menu - each works with the expected confirmation/toast behavior.
- As the student, confirm no management menu appears on any assignment card.
- See [Content Scheduling](#content-scheduling) below for the Schedule/Cancel-scheduled-publication flow shared by announcements, assignments, and materials.

**10. Classwork - assignment detail page, submissions & grading**

- Click an assignment's title (as either role) to open its dedicated detail page.
- Confirm it shows the full instructions (untruncated), due date, points, and attachments, reusing the same management menu for teachers.
- As the student: turn in work via the submission panel (text answer and/or attachments) - status moves Assigned → Submitted (or Late, past the due date). Turn it in again before the teacher reviews it and it stays editable.
- As the teacher: open the roster-style submissions list, click into a student's submission, enter a grade (bounded by the assignment's points) and feedback, and return it - the student sees the grade badge and feedback, and a private comment thread is available on either side.
- As the student, try navigating directly to a **draft** assignment's detail URL - you should get a clean "Assignment not found" page, not the real content.
- See [Teacher Review Queue](#teacher-review-queue) below for the centralized, cross-classroom "To review" page built on top of this same grading flow.

**11. Responsive check**

- Repeat steps 3-10 with the browser narrowed to a phone-sized viewport (or DevTools device mode) - the drawer nav, dialogs, and comment threads should all remain usable.

## Content Scheduling

Announcements, assignments, and materials all share one scheduling engine rather than three separate implementations. Every piece of content moves through the same status lifecycle - **Draft → Scheduled → Published** (assignments add a fourth, terminal **Closed** state, unrelated to scheduling) - and the same three teacher-facing actions apply everywhere: **Schedule for later**, **Cancel scheduled publication**, and **Publish now**.

- **Create time**: the create dialog/composer for each content type has a shared "Save as draft / Publish now / Schedule for later" control. Choosing **Schedule for later** reveals a date & time picker; the content is created straight into the Scheduled state.
- **Managing existing drafts**: a draft or scheduled item's management menu offers **Publish now**, **Schedule…** (drafts only) or **Cancel scheduled publication** (scheduled items only), alongside the existing Edit/Delete.
- **Visibility**: Draft and Scheduled content is only visible to whoever manages that classroom (teacher/co-teacher/admin) - students never see it until it actually publishes, the same rule already used for draft assignments.
- **Guardrails**: content in an archived classroom can't be scheduled or published; a closed assignment can never be (re-)scheduled; a scheduled time must be in the future.
- **Status badges**: cards show a **Draft**, **Scheduled** (with the publish date/time), or **Closed** badge; published content shows no badge, matching the existing convention.
- **Architecture**: the shared engine (`server/src/lib/scheduling`) knows nothing about Prisma or any specific content type - each feature (`stream`, `classwork`) implements a small adapter bridging its own model to the engine. `publishScheduledContent` runs automatically once a minute in the API process (`server/src/features/scheduling/publish-worker.ts`) and is also exposed to admins as `POST /api/scheduling/publish-due`.

### Content scheduling manual testing walkthrough

A step-by-step path through the scheduling flow for all three content types. Sign in as the teacher (`daniel.teacher@gcr.dev`) unless a step says otherwise - see [Seed accounts](#seed-accounts) for the passwords.

**1. Draft → Schedule → Cancel → Reschedule → Publish now (announcements)**

- Open **Stream**, and in the composer choose **Schedule for later** instead of the default **Publish now** - a date & time picker appears; pick a time a few minutes out and submit.
- Confirm the announcement now shows a **Scheduled** badge with the date/time you picked, and that it's still visible to you (the manager).
- Open a private/incognito window and sign in as the student (`sofia.student@gcr.dev`) - confirm the scheduled announcement does **not** appear on the Stream at all.
- Back as the teacher, open the announcement's **⋮** menu and choose **Cancel scheduled publication** - the badge changes to **Draft** and the scheduled time is cleared.
- Open the **⋮** menu again and choose **Schedule…** - pick a new date/time and confirm; the badge returns to **Scheduled** with the new time.
- Finally, choose **Publish now** from the same menu - the badge disappears (published content shows no badge), and refreshing the student's window now shows the announcement.

**2. Assignments - scheduling respects Draft/Scheduled/Published/Closed**

- In **Classwork**, use **+ Create → Assignment**, fill in the details, and this time choose **Schedule for later** in the create dialog's publish controls, picking a future date/time, then submit.
- Confirm it appears in your list with a **Scheduled** badge, and that the student's Classwork list doesn't show it at all (same rule as Draft).
- From its management menu, try **Publish now** - it should publish immediately, badge disappears, and it becomes visible to the student.
- **Close** the assignment from the same menu, then try to re-open its menu - **Schedule…** and **Publish now** should no longer be offered at all, since a closed assignment is a terminal state and can never be (re-)scheduled.
- Create a second assignment as a plain **Save draft**, then use **Schedule…** from its management menu (rather than at create time) to verify rescheduling an existing draft works the same way as the create-time flow.

**3. Materials - scheduling is a brand-new capability here**

- In **Classwork**, use **+ Create → Material**, add a link or description, and choose **Schedule for later** - materials previously had no draft/scheduled concept at all, so confirm this now behaves exactly like announcements/assignments: a **Scheduled** badge, invisible to the student, manageable via **Publish now** / **Schedule…** / **Cancel scheduled publication** from its **⋮** menu.

**4. Guardrails**

- Archive a classroom (from its card's **⋮** menu, or `/admin/classrooms`) that still has a draft item in it, then try to **Schedule…** or **Publish now** that item - it should fail with an "This class is archived…" error instead of silently succeeding.
- Restore the classroom afterward so the rest of the walkthrough still works.

**5. Notifications**

- When an item transitions to Published - whether by **Publish now** or by letting a schedule complete (see below) - confirm the student receives the same "New announcement/assignment/material in <class>" notification (bell icon) they'd get from an immediate, non-scheduled post.

**6. Confirming a real scheduled publish (optional, no UI trigger yet)**

- Scheduled items publish automatically: the API runs `publishScheduledContent` once a minute. Schedule an item a minute or two ahead, wait, and reload - it switches from **Scheduled** to published, and students are notified.

## Teacher Review Queue

`/review` is a single, cross-classroom page listing every submission a teacher (or admin) needs to act on - no more clicking into each class's Classwork tab one at a time. It's gated to `UserRole.TEACHER`/`ADMIN` the same way `/admin` is gated to `ADMIN` - the client redirects anyone else to `/dashboard?denied=review` and `GET /api/review` answers 403, and the "To review" sidebar link is hidden from students entirely.

- **What shows up**: submitted, late, and returned submissions across every classroom the signed-in teacher manages (an admin sees every active classroom platform-wide, the same bypass rule used everywhere else). A student's in-progress draft is never listed - consistent with the rule already used on a single assignment's submission list, where a draft is invisible to teachers, not just hidden.
- **Filters**: classroom, assignment, student, status (Submitted / Late / Returned), and a due-before date - all URL-driven (`?classroomId=`, `?status=`, etc.), so a filtered view is a shareable/bookmarkable link. Picking a classroom narrows the assignment and student dropdowns to just that class.
- **Sorting**: Newest, Oldest, Due date, Student name, Assignment name - click a column header or use the sort dropdown.
- **Summary tiles**: Pending reviews, Late submissions, Returned today, Recently submitted (last 48 hours) - computed with a single aggregate query, not by counting the current page of rows.
- **Actions, without leaving the queue**: click **Open** on any row to open a dialog with the full grading panel - the exact same component used on the dedicated submission page - so **Grade**, **Return**, and **Leave a private comment** all work inline. A link inside the dialog also jumps to the full submission page if you'd rather work there.
- **Query optimization**: the row list is one indexed `findMany` (classroom/assignment/student/status/due-date filters all pushed into the `WHERE` clause, sorting done in the database, not in JavaScript) plus one `count()` for pagination - no per-row follow-up queries. The four summary tiles are computed by a single raw SQL query using conditional `COUNT(*) FILTER (WHERE ...)` aggregates instead of four separate round trips.

### Teacher review queue manual testing walkthrough

Sign in as the teacher (`daniel.teacher@gcr.dev`) unless a step says otherwise - see [Seed accounts](#seed-accounts) for the passwords.

**1. Access control**

- Signed out, visit `/review` directly - redirected to `/login`.
- Signed in as the student seed account, visit `/review` directly - redirected to `/dashboard?denied=review` with an error toast; the **To review** sidebar link is absent from the student's nav entirely.
- Signed in as the teacher, click **To review** in the sidebar (or visit `/review`) - the page loads with summary tiles, filters, and a table.

**2. Getting submissions into the queue**

- As the student (`sofia.student@gcr.dev` or `liam.student@gcr.dev`), turn in an assignment that's still open - go back to the teacher and confirm it now appears in `/review` with a **Submitted** badge.
- Turn in a second assignment after its due date has passed (or edit the assignment's due date to the past first, then submit) - confirm it shows a **Late** badge instead.
- From either the queue's quick-review dialog or the full submission page, return one of them - confirm its badge changes to **Returned** and it now counts under the **Returned today** summary tile.

**3. Filters**

- Filter by **Classroom** - confirm the assignment and student dropdowns narrow to just that class's options, and the table only shows that class's rows.
- Filter by **Status** (Submitted / Late / Returned) one at a time - confirm only matching rows remain.
- Filter by a specific **Assignment** or **Student** - confirm the table narrows accordingly; clear the filter (back to "All…") and confirm rows return.
- Set **Due before** to a date before any of your assignments were due - confirm the table empties out and shows the "Nothing to review" empty state.

**4. Sorting**

- Try each sort option - **Newest**, **Oldest**, **Due date**, **Student name**, **Assignment name** - and confirm the row order changes accordingly; click a sortable column header as a shortcut for the same thing.

**5. Actions inline**

- Click **Open** on a submitted row - a dialog opens with the student's work, attachments, and a grade input (bounded by the assignment's points).
- Enter a grade and feedback, save it, then **Return** the submission from the same dialog - confirm the toast, the badge updating to **Returned**, and that the student sees the grade on their end (sign in as them to confirm).
- Post a private comment from the dialog - confirm it appears immediately, and that it's the same thread visible on the full submission page (open **Open full page** from the dialog to cross-check).

**6. Cross-classroom scope**

- If the teacher manages more than one classroom, confirm submissions from every one of them appear in the unfiltered queue, not just the first class - this is the entire point of the page versus checking each class's Classwork tab individually.
- Sign in as the admin (`faizan.admin@gcr.dev`) and visit `/review` - confirm it shows submissions across every active classroom platform-wide, not just ones the admin personally teaches.

## Archived Classroom Experience

Archiving a classroom (from its card's **⋮** menu, or `/admin/classrooms`) makes it fully read-only, closely matching Google Classroom's own archived behavior - rather than just hiding a few buttons, every content-mutating API endpoint independently refuses to run against an archived classroom, whether or not the UI happened to expose a way to trigger it.

- **Teachers can still**: view the classroom, view announcements/assignments/materials/grades, restore the classroom, and copy the class code. They can no longer post announcements, create assignments, upload materials, invite members, or edit the classroom's own title/section/description - and editing or deleting any _existing_ announcement/assignment/material is blocked too, since the objective is a genuinely read-only class, not just a frozen "create" button.
- **Students can still**: view the classroom, announcements, assignments, grades, and download existing material attachments. They can no longer submit or unsubmit assignments, post (or receive) Stream comments, or join the class by code.
- **Grading stays open on purpose**: returning a submission, entering/editing a grade, and private submission comments between a teacher and student are _not_ blocked by archiving - this matches real Google Classroom (grading work already turned in doesn't freeze) and isn't one of the stated restrictions.
- **Permission model**: `canManageClassroom(role)` (Owner/Teacher/Co-Teacher, or an Admin via its existing bypass) still determines who _can_ manage a classroom regardless of archived state - it's what gates the **Restore** action. A separate, new `canModifyClassroom(role, status)` helper (`client/src/features/classroom/lib/can-manage.ts`, mirrored on the server) additionally requires the classroom to be `ACTIVE`, and is what every page now uses to decide whether to render a composer, a "+ Create" button, an Invite button, or a per-item management menu. Permanently deleting a classroom remains exclusively an Admin action from `/admin/classrooms` - there is no teacher-facing delete.
- **Server enforcement**: a single reusable `assertClassroomActive(classroom)` guard (`classroom-service.ts`) is called by every mutation across the classroom, stream, classwork, submissions, and invitation services before it does anything else - never rely on a hidden or disabled button alone. The same function replaced several pre-existing, duplicated `if (status === ARCHIVED) throw` checks scattered across those services.
- **UI indicators**: an **Archived** badge over the class banner, a dismissible-by-restoring banner explaining the read-only state, the quick-actions menu swapping **Edit class** / **Archive class** for **Restore class**, disabled/hidden compose and invite controls, and a plain-text note in place of the comment box and submission form for students.
- **Finding an archived class**: `/archived` (the "Archived classes" sidebar link) lists every archived classroom the signed-in user still belongs to - or, for an admin, every archived classroom platform-wide, the same bypass rule used elsewhere. Each card opens straight into the read-only classroom and carries the same **⋮** → **Restore class** shortcut.

### Archived classroom manual testing walkthrough

Sign in as the teacher (`daniel.teacher@gcr.dev`) unless a step says otherwise - see [Seed accounts](#seed-accounts) for the passwords.

**1. Archiving and the read-only indicators**

- From `/classes`, use the "Advanced Mathematics 101" card's **⋮** menu and choose **Archive class** (confirm the dialog first).
- Open the class - confirm an **Archived** badge now sits over the banner, and a banner strip below it reads "This class is archived and is now read-only," with a **Restore class** button (teacher view only - a student sees the same banner without the button).
- Open the **⋮** menu again - **Edit class** and **Archive class** are gone, replaced by a single **Restore class** item; **Copy class code** is still there.
- Click **Archived classes** in the sidebar (`/archived`) - confirm the class now appears there with a working **Restore class** shortcut on its own **⋮** menu; sign in as the student and confirm she sees the same class on her own `/archived` page (she's a member, even though she can't manage it); sign in as the admin and confirm `/archived` shows it too, even without being a member (platform-wide view).

**2. Teacher restrictions**

- On **Stream**, confirm the announcement composer is gone entirely - there is nothing to click to attempt a post.
- On **Classwork**, confirm the **+ Create** button (Assignment/Material/Topic) is gone, and that every assignment/material card's **⋮** management menu (Edit/Delete/Publish/Schedule/Close) is gone too - the cards themselves still render normally, just without controls.
- On **People**, confirm the **Invite** button is gone from the Pending invitations section (the section itself, and the roster, are still visible).
- Try navigating directly to `/classes/<id>` and using the class's **⋮** → there is no way left to reach an Edit dialog for the class's title/section/description.

**3. Student restrictions**

- Sign in as a student in this class (`sofia.student@gcr.dev`). Confirm Stream, Classwork, and People all still show their existing content.
- Open any announcement - confirm the "Add class comment…" box is replaced by "Comments are turned off because this class is archived."
- Open an assignment that was already published before archiving - confirm the submission panel shows "This class is archived - submissions are closed" instead of the response textarea/attachment picker/Turn in button (if the student already had a submission in progress, its read-only content still displays).
- Confirm there is no way to join this class from `/classes` even with the correct class code (try **Join class** with it) - you should get an "archived and no longer accepting new members" error.

**4. Restore**

- Back as the teacher, click **Restore class** (from the banner or the **⋮** menu).
- Confirm the Archived badge/banner disappear immediately, and that the composer, **+ Create** button, per-item management menus, and Invite button are all back.
- As the student, confirm the comment box and submission form are usable again on the same announcement/assignment as before.

**5. Server enforcement, not just UI**

- While the class is archived again (or by re-archiving it), open a second browser tab to an already-open Edit/Create dialog you had queued up before archiving (or replay a previous form submission) - confirm it fails with a clear "This class is archived…" error rather than silently succeeding, proving the block isn't just a hidden button.

**6. Grading stays open**

- With the class archived, open an already-submitted assignment's submission (from `/review` or the classwork submissions list) and confirm you can still enter a grade, return it, and post a private comment - none of that is blocked by archiving, matching real Google Classroom.

**7. Permissions**

- Confirm a co-teacher (promote a student to **Co-teacher** first, from People) can also restore the class - restore isn't owner-only.
- Confirm there is no delete option anywhere in the teacher-facing UI for this class; only `/admin/classrooms` (Admin-only) can permanently delete a classroom.

## Dashboard Enhancements

`/dashboard` is role-specific, not a shared placeholder - a Teacher and a Student see genuinely different content, and an Admin visiting `/dashboard` is sent straight to `/admin` (which is itself now a real, fully wired dashboard rather than the static stub it was left as after Phase 13.1).

- **Teacher dashboard** (`/dashboard` signed in as Teacher): Active/Archived classroom counts, a **Review queue** section that reuses the exact same summary tiles component as `/review` (Pending reviews, Late submissions, Returned today, Recently submitted), a **Scheduled content** breakdown of currently-Scheduled announcements/assignments/materials across the classes they manage, and an **Upcoming publications** list of the soonest-to-publish scheduled items, each linking straight into its classroom.
- **Student dashboard** (`/dashboard` signed in as Student): Active/Archived classroom counts, an **Upcoming deadlines** list of Published assignments due soon (never drafts or scheduled ones - the query only ever selects Published, so nothing a student shouldn't see yet can leak through here), and an **Archived classes** section previewing up to three archived classes with a "View all" link to the full `/archived` page.
- **Admin dashboard** (`/admin`): the platform-wide stat tiles (users by role, classrooms, assignments, submissions, announcements) plus two new tiles - **Archived classrooms** and platform-wide **Scheduled content** (the same summary component the Teacher dashboard uses, just unscoped) - and a **Platform activity** section reusing the existing recent-activity feed from `/admin/reports`.
- **Reuse over duplication**: nothing here re-implements logic that already exists elsewhere - the Review queue tiles, the recent-activity feed, and the archived-classroom card are all the literal same components/queries used by `/review`, `/admin/reports`, and `/archived` respectively, just re-composed. New shared pieces (`ScheduledContentSummary`, `UpcomingItemsList` and its two thin wrappers) were built once and reused across whichever dashboards need them.
- **Query optimization**: every scheduled/archived count is a single indexed `count()` (backed by the `(status, scheduledFor)` index added in Phase 14.1); "Upcoming publications" fetches a small, bounded `take: 5` from each of the three content tables in parallel and merges the results in memory instead of attempting a cross-table SQL `UNION`; every dashboard's tiles are fetched together via one `Promise.all`, never sequentially.

### Dashboard manual testing walkthrough

Sign in as the teacher (`daniel.teacher@gcr.dev`) unless a step says otherwise - see [Seed accounts](#seed-accounts) for the passwords.

**1. Role-specific routing**

- Signed in as the teacher, visit `/dashboard` - confirm you see the Teacher dashboard (Review queue, Scheduled content, Upcoming publications), not the old generic placeholder.
- Sign in as the student and visit `/dashboard` - confirm you see the Student dashboard (Upcoming deadlines, Archived classes) instead.
- Sign in as the admin and visit `/dashboard` - confirm you're taken to `/admin` (a real browser follows this immediately; a raw `curl`/HTTP client won't, since this Next.js build emits the redirect as a client-side meta-refresh when streaming rather than a hard 307 - that's expected, not a bug).

**2. Teacher dashboard**

- Note the **Active classes** / **Archived classes** counts, then archive a class (see [Archived Classroom Experience](#archived-classroom-experience)) and refresh - confirm **Archived classes** increments and **Active classes** decrements; restore it afterward.
- Schedule an announcement, an assignment, and a material for a few minutes out (see [Content Scheduling](#content-scheduling)) - refresh `/dashboard` and confirm the **Scheduled content** tiles show 1/1/1 (plus a total of 3), and all three appear in **Upcoming publications**, soonest first, each linking into the right classroom's Stream or Classwork tab.
- Click **Open review queue** next to the Review queue tiles - confirm it takes you to `/review`, and that the numbers shown on the dashboard match the summary tiles there exactly (they're the same underlying query).

**3. Student dashboard**

- As the student, note **Upcoming deadlines** - confirm it lists Published assignments with a future due date, soonest first, and that clicking one opens its assignment detail page.
- Confirm a Scheduled or Draft assignment (created by the teacher but not yet published) never appears in this list - visibility rules are enforced in the query itself, not filtered client-side.
- Archive a class the student is enrolled in - confirm it now shows up under the dashboard's **Archived classes** section (and the **Archived classes** count ticks up); restore it afterward. If the student is in more than three archived classes, confirm a "View all N archived classes" link appears and goes to `/archived`.

**4. Admin dashboard**

- Visit `/admin` directly - confirm the platform stat tiles now render real numbers (not the old "—" placeholders), including the new **Archived classrooms** tile.
- With the scheduled content from step 2 still in place, confirm the Admin dashboard's **Scheduled content** tiles show the same platform-wide total (3 or more, depending on what else is scheduled elsewhere) - unscoped, unlike the teacher's classroom-scoped view.
- Confirm **Platform activity** shows the same recent-activity feed as `/admin/reports` - archiving/restoring a classroom or scheduling content in the steps above should appear here.

## Global Search Infrastructure

The backend for cross-application search (`server/src/features/search`, served as `GET /api/search`) - a shared, authorization-aware search service. It now powers a full search UI - see [Global Search Experience](#global-search-experience) below for the user-facing dialog/results page and its manual testing walkthrough. Everything in this section is instead about the service layer itself, verified via a script or by calling the exported functions directly, not by clicking anything - useful if you're changing the service and want to confirm scoping/authorization without going through the UI.

- **What's searchable**: Classrooms (title/section/subject), Announcements (title/content), Assignments (title/description), Materials (title/description), and - Admin only - Users (name/email). Adding a new searchable entity means adding one function to `search-service.ts`; the scoping, merging, and counting pipeline around it is entity-agnostic.
- **Authorization-aware, not filtered after the fact**: a new `getClassroomSearchScope(user)` helper (`classroom-service.ts`) computes, in one query, which classrooms a user manages (full visibility, drafts/scheduled included) versus is only a plain member of (published-only visibility) - the exact same per-classroom rule every feature already enforces individually, just applied across every classroom the viewer can see at once. Archived classrooms are deliberately **included** in scope (only soft-deleted ones are excluded) - archived content stays readable (see [Archived Classroom Experience](#archived-classroom-experience)), so it must stay findable too. Admins bypass membership entirely and search platform-wide, the same convention used everywhere else in the app.
- **Reusable pieces**: `search()` in `search-service.ts` (the shared service - one call, five entity types queried in parallel, merged and sorted by recency), `getSearchResults()` in `queries/search-queries.ts` (server-only, for a future results page), `globalSearchAction()` in `actions/search-actions.ts` (the client-invokable global search endpoint), and `useGlobalSearch()` in `hooks/use-global-search.ts` (a debounced client hook - feed it keystrokes via `setQuery`, it debounces, skips trivial queries, and calls the action). `lib/search-text.ts` and `lib/search-constants.ts` hold the small normalization/truncation utilities and shared constants (`MIN_QUERY_LENGTH`, `DEFAULT_LIMIT_PER_TYPE`, `SEARCH_DEBOUNCE_MS`) every entry point uses.
- **Query optimization**: below `MIN_QUERY_LENGTH` (2 characters), `search()` returns an empty result set without touching the database at all. Otherwise it's exactly five bounded, indexed queries (`take: limit`, default 5 per type) run together via `Promise.all` - never sequential, never per-row.

### Global search infrastructure manual testing walkthrough

This walkthrough tests the service layer directly with a throwaway script rather than through the UI, the same way this phase was verified during development - useful for confirming scoping/authorization in isolation. For the click-through version, see [Global Search Experience](#global-search-experience) instead. Run these from the project root with the dev database up (`docker compose up -d`).

**1. Set up a throwaway verification script**

- Create a temporary file, e.g. `scripts-verify-search-tmp.ts`, importing `search` from `@/features/search/services/search-service.ts` and `prisma` from `@/lib/prisma`.
- Look up a teacher, a student, and the admin from the seed data (`prisma.user.findFirst({ where: { role: ... } })`), and an active classroom the teacher owns.
- Run it with `npx tsx --require dotenv/config scripts-verify-search-tmp.ts`, then delete the file when done - don't leave it in the repo.

**2. Authorization scoping**

- Create a draft assignment and a published announcement/assignment/material in the teacher's classroom with a distinctive, uncommon title (e.g. prefix everything with a random word so it can't collide with seed data).
- Call `search(teacherSessionUser, { query: "<your word>" })` - confirm all of them come back, including the draft (the teacher manages this classroom).
- Call `search(studentSessionUser, { query: "<your word>" })` (using a student actually enrolled in that classroom) - confirm the draft assignment is **absent** but the published items are present.
- Call `search(teacherSessionUser, { query: "<your word>", entityTypes: ["user"] })` - confirm it returns nothing (non-admins can't search users, regardless of what they search for).
- Call `search(adminSessionUser, { query: "<any existing user's first name>" })` - confirm matching users appear with `entityType: "user"` and an `href` pointing at `/admin/users?q=<email>`.

**3. Archived classrooms stay searchable**

- Archive the teacher's classroom (`classroomService.archiveClassroom` or the `/classes` UI from [Archived Classroom Experience](#archived-classroom-experience)).
- Re-run the same teacher search from step 2 - confirm the results are unchanged (archived classroom content is still found, matching the rule that archived classrooms remain fully readable).
- Restore the classroom afterward.

**4. Query-length guard and result shape**

- Call `search(teacherSessionUser, { query: "a" })` (below `MIN_QUERY_LENGTH`) - confirm it returns `{ query: "a", totalCount: 0, items: [], countsByType: { ...all zero } }` immediately, without needing any matching data to exist.
- Call `search(teacherSessionUser, { query: "<your word>", entityTypes: ["material"] })` - confirm only material results come back, even though the announcement/assignment also match.

**5. Clean up**

- Delete the test announcement/assignment/material created in step 2 and remove the throwaway script - the feature itself adds no new routes or UI, so there's nothing else to reset.

## Global Search Experience

The user-facing layer on top of the search service above (`client/src/features/search` and `client/src/pages/account/search-page.tsx`) - a command-palette-style dialog and a dedicated results page, both reading from the exact same `getSearchResults()`/`search()` pipeline described in [Global Search Infrastructure](#global-search-infrastructure), so anything true about scoping/authorization there is true here too.

- **Opening it**: click the search bar in the header (desktop), the magnifying-glass icon in the header (mobile, replaces the search bar below the `md` breakpoint), or press **Ctrl + K** (**⌘K** on Mac) from anywhere in the app - the shortcut is a global listener mounted once at the shell level, not tied to any particular page.
- **The dialog**: a top-anchored modal with a single search input. Typing debounces (300ms) before it queries, and results are grouped by type (Classrooms, Announcements, Assignments, Materials, Topics, Users) with an icon per type and the matched text highlighted inline (`<mark>`) in both the title and description.
- **Recent searches**: shown in the dialog when the input is empty and you have search history - stored in `localStorage`, namespaced per signed-in user, capped at 8 entries, most-recent-first, with a **Clear** link. Click one to re-run it instantly.
- **Loading / empty / no-results states**: a skeleton list while a query is in flight, a "Search GCR" placeholder (or your recent searches) when the input is empty, and an explicit "No results for '...'" message with a suggestion to try a different term when a query returns nothing.
- **Results page (`/search?q=...`)**: press **Enter** in the dialog, or click **View all results for "..."**, to land on a full page with the same grouped/highlighted results (a higher per-type limit than the dialog), plus filter chips (**All** and one per entity type, each showing a count) that toggle `?type=` without losing the query.
- **Reuse, not duplication**: a single `SearchResultRow` component renders every result identically in both the dialog and the results page; a single `HighlightMatch` component does the highlighting in both places too.

### Global search experience manual testing walkthrough

Sign in as any seed account (teacher, student, or admin) - see [Seed accounts](#seed-accounts) for the passwords. Search results always respect the same authorization scoping as [Global Search Infrastructure](#global-search-infrastructure) (e.g. a student never sees a teacher's draft assignment, and only an admin's search includes Users).

**1. Opening the dialog**

- Click the search bar in the header - the dialog opens centered near the top of the screen with the input already focused.
- Close it (click outside, or press `Esc`), then press **Ctrl + K** (**⌘K** on Mac) - confirm it opens the same dialog from anywhere, including from deep inside a classroom page, not just from `/dashboard`.
- Press **Ctrl + K** again while it's open - confirm it closes (the shortcut toggles).
- Narrow the browser to a phone-sized viewport - confirm the header search bar disappears and a magnifying-glass icon appears instead; click it and confirm it opens the same dialog.

**2. Empty state and recent searches**

- Open the dialog fresh (or clear any existing search history for this browser) - confirm it shows a "Search GCR" placeholder with no results list.
- Type a searchable query (2+ characters, e.g. part of a classroom name like "Advanced"), let results load, then either press **Enter** or click a result to close the dialog.
- Reopen the dialog - confirm your previous query now appears under **Recent searches**. Click it - confirm it re-populates the input and re-runs the search immediately.
- Repeat with a few different queries, then click **Clear** next to "Recent searches" - confirm the list empties and the placeholder returns.

**3. Loading, results, and highlighting**

- Type a query slowly, letter by letter - confirm there's a brief debounce before anything happens (it shouldn't query on every keystroke), then a loading skeleton appears briefly before results replace it.
- Confirm results are grouped under headings (Classrooms, Announcements, Assignments, Materials, Topics, and - admin only - Users), each with a type-specific icon.
- Confirm the part of the title/description matching your query is visually highlighted (e.g. type "math" and confirm "Math" is highlighted inside "Advanced **Math**ematics 101").
- Type a query with no matches anywhere (e.g. a random string like "zzznotreal") - confirm a "No results for '...'" message appears instead of an empty list with no explanation.

**4. Results page**

- With a query typed in the dialog, press **Enter** (not clicking a specific result) - confirm you land on `/search?q=<your query>` showing the same grouped, highlighted results in a full page.
- Click one of the filter chips (e.g. **Assignments**) - confirm the URL updates to include `&type=assignment` and only assignment results remain, with that chip now visually active; click **All** to go back to every type.
- Visit `/search` directly with no `?q=` - confirm it shows a "Type something to search" prompt rather than an empty results list or an error.
- Visit `/search?q=zzznotreal` directly - confirm the same "No results" message from the dialog appears here too.
- From the dialog, click **View all results for "..."** instead of pressing Enter - confirm it navigates to the same results page and the query you typed is preserved.

**5. Recent searches persist correctly per user**

- Search for something distinctive as the teacher, then sign out and sign in as the student - confirm the student's recent searches list does **not** include the teacher's query (it's namespaced per user in `localStorage`).

**6. Authorization scoping, via the UI this time**

- As a student, search for a draft assignment's title that a teacher created but hasn't published yet - confirm it does not appear in either the dialog or the results page.
- As that teacher (who manages the classroom), search the same title - confirm the draft assignment now appears.
- As a non-admin (teacher or student), confirm no **Users** group ever appears in your search results, no matter what you search for.
- As the admin, search for another user's name or email - confirm a **Users** group appears and clicking a result takes you to `/admin/users?q=<their email>`.

## Calendar

`/calendar` aggregates events from across the other modules - due dates, scheduled content, and classroom milestones - into a single Month/Week/Day calendar, without any of those modules knowing the calendar exists. There is no calendar-specific "create event" UI; every event is derived from content you already create elsewhere (Classwork, Stream), and the calendar simply reflects it.

- **What shows up**: assignment due dates (`server/src/features/calendar/services/providers/assignment-due-date-provider.ts`), scheduled assignments/announcements/materials (`scheduled-content-provider.ts`), and a "classroom created" milestone (`classroom-events-provider.ts`) - each a small, independent provider registered into a shared `CalendarEventProvider` registry (`calendar-providers.ts`). A future event source (recurring events, an external ICS/Google Calendar/Outlook sync) plugs in the same way, with no changes to the calendar's service, queries, or any view component - the `CalendarEvent` shape already carries optional `recurrenceRule`/`seriesId` fields reserved for that.
- **Views & navigation**: Month (a 6-week grid), Week (7-day columns, stacking to a vertical list below `lg`), and Day (a single agenda list) - all URL-driven (`?view=`, `?date=`), with **Prev / Next / Today** controls and a view switcher that never lose the current filters when you click through.
- **Filters**: a classroom dropdown and event-type toggle chips (Assignment due / Assignment scheduled / Announcement scheduled / Material scheduled / Classroom), both URL-driven (`?classroomId=`, `?types=`) and preserved across every navigation link on the page.
- **Sidebar**: **Today** (just today's events), **Upcoming** (the next 14 days, up to 8 shown), and a **Monthly agenda** (every event in the browsed month, grouped by day) - independent of which grid view is active.
- **Event details dialog**: clicking any event (chip or row) opens a dialog with its type, full date/time, classroom, and description, plus a **View** button that navigates to the underlying resource (the assignment page, the classroom's Stream, or its Classwork tab) - reusing those existing routes, not a new detail view.
- **Authorization**: the exact same classroom-scoping rule Search uses (`getClassroomSearchScope`) - a student only ever sees events for classrooms they've joined, and only once content is actually Published (never a draft or a teacher's still-Scheduled item); a teacher additionally sees Scheduled assignments/announcements/materials for classrooms they manage (matching the rule from [Content Scheduling](#content-scheduling) that Draft/Scheduled content is manager-only); an admin sees every classroom's events platform-wide. This is enforced in every provider's own query, not filtered after the fact - even a hand-edited `?classroomId=` for a classroom you don't belong to returns zero events rather than leaking anything.
- **Query optimization**: the page needs events for four different ranges at once (the active view, today, the upcoming window, and the browsed month) plus the filter dropdown's classroom list - `getCalendarPageData()` computes the session and classroom scope exactly once and shares both across all five underlying queries, and a classroom filter is pushed down into each provider's query instead of fetched broadly and discarded afterward.
- **Accessibility**: every event chip/row is a real, keyboard-focusable button with a visible focus ring; the month grid carries `role="grid"`/`columnheader`/`gridcell`; today's date carries `aria-current="date"`; and a month-view chip (which distinguishes event types by color alone, for space reasons) has an accessible name spelling out the type, title, and time for screen readers rather than relying on color.

### Calendar manual testing walkthrough

Sign in as the teacher (`daniel.teacher@gcr.dev`) unless a step says otherwise - see [Seed accounts](#seed-accounts) for the passwords. Since the calendar has no UI of its own to create events, most of this walkthrough is "schedule something in Classwork/Stream, then confirm it shows up correctly on `/calendar`."

**1. Access and default view**

- Signed out, visit `/calendar` directly - redirected to `/login`, same as every other `(app)` route.
- Signed in as any role, click **Calendar** in the sidebar - confirm it lands on `/calendar` with no query params, defaulted to **Month** view and the current month, with an empty grid (no events yet) and empty **Today**/**Upcoming**/agenda sidebar sections showing their respective "nothing yet" messages.

**2. Get an assignment due date onto the calendar (Teacher)**

- In any classroom's **Classwork** tab, create and publish an assignment with a due date a few days out (see [Content Scheduling](#content-scheduling) if you want to also try the Schedule-for-later flow first).
- Back on `/calendar`, confirm an **Assignment due** chip appears on the correct day in Month view (color-coded amber) - click it to open the event details dialog, confirm the title/time/classroom are correct, then click **View** and confirm it takes you straight to that assignment's detail page.
- Switch to **Week** view (the view switcher, top right of the toolbar) and then **Day** view (click the due date's day number, or use the switcher) - confirm the same event appears in both, now as a fuller row showing its type label and classroom name as text, not just color.

**3. Get scheduled content onto the calendar (Teacher)**

- Schedule an announcement, an assignment, and a material for a few minutes or hours out (see [Content Scheduling](#content-scheduling) for the **Schedule for later** flow on each).
- Confirm all three appear on `/calendar` as **Assignment scheduled** / **Announcement scheduled** / **Material scheduled** events (three distinct colors) on the day/time you picked, and that each one's **View** button in the details dialog goes to the right place (assignment page, Stream, Classwork respectively).
- Confirm they also appear in the **Today** sidebar section if scheduled for today, or the **Upcoming** section (with their date shown, not just a time, since Upcoming can span many days) if scheduled within the next two weeks, and in the **Monthly agenda** section grouped under the correct day either way.

**4. Authorization - Student never sees what they shouldn't**

- Sign in as the student (`sofia.student@gcr.dev`) and visit `/calendar`.
- Confirm the **Assignment due** event from step 2 is visible (it's published).
- Confirm **none** of the three scheduled events from step 3 appear anywhere on the student's calendar - not in the grid, not in Today/Upcoming, not in the Monthly agenda - since Scheduled content is manager-only, the same rule as everywhere else in the app.
- Back as the teacher, **Publish now** one of the scheduled items (its management menu, from Stream/Classwork) - refresh the student's `/calendar` and confirm it now appears (as a due-date/published event, no longer as a "scheduled" one).

**5. Authorization - Admin sees everything, platform-wide**

- Sign in as the admin (`faizan.admin@gcr.dev`) and visit `/calendar` - confirm events from every classroom on the platform appear (not just ones the admin personally teaches), including any still-Scheduled items, matching the platform-wide bypass used everywhere else in the app.

**6. Filters**

- As the teacher, open the classroom filter dropdown - confirm it only lists classrooms you actually belong to (manage or are a member of), select one, and confirm the grid/sidebar narrow to just that classroom's events.
- Toggle off every event-type chip except **Assignment due** - confirm only due-date events remain visible everywhere on the page (grid, Today, Upcoming, agenda); toggle a second type back on and confirm it reappears.
- With a classroom and a type filter both active, click **Next**/**Previous**/**Today** or switch views - confirm the filters stay applied (check the URL: `classroomId=` and `types=` should persist alongside `view=`/`date=`).
- Manually edit the URL to a `classroomId` you don't belong to (any random UUID) - confirm the page loads normally with zero events, not an error or someone else's data.

**7. Navigation**

- Click **Next** and **Previous** a few times in Month view - confirm the month advances/retreats by exactly one month each click (test crossing a year boundary, e.g. December → January).
- Switch to Week view and click **Next**/**Previous** - confirm it moves by exactly 7 days. Switch to Day view and confirm it moves by exactly 1 day.
- Click **Today** from any other month/week/day - confirm it jumps straight back to the current date without losing your active view mode or filters.
- In Month view, click a day number (not an event) - confirm it drills into Day view for that specific date.

**8. A busy day (overflow handling)**

- Schedule or due-date several (5+) items onto the same single day.
- In Month view, confirm that day's cell shows only the first few chips plus a **"+N more"** link rather than growing the cell indefinitely; click it and confirm it opens Day view for that date showing everything.
- In Week view, confirm the same day's column caps similarly with its own **"+N more"** link, rather than stretching that entire week's row height to fit every event.

**9. Responsive check**

- Narrow the browser to a phone-sized viewport. Confirm the sidebar (Today/Upcoming/agenda) stacks below the calendar grid rather than beside it, the filter bar's controls wrap onto multiple lines instead of overflowing, and the Week view's 7 day-columns become a single vertical list.
- Confirm the event details dialog remains fully usable and doesn't overflow the viewport at this width.

**10. Clean up**

- Delete or unpublish the test assignment/announcement/material created in steps 2-3 if you'd rather not leave them in the seed classroom.

## Admin Platform

> **Current admin pages:** Users (`/admin/users`), Classrooms (`/admin/classrooms`), Timetable clashes (`/admin/timetable`), Audit Logs (`/admin/audit-logs`) and the Platform settings section of `/settings` (`/admin/settings` redirects there); the admin dashboard is the admin view of `/dashboard`. The Moderation, Reports and Security pages described further down were removed from the app before the Express/React migration - those parts of this section are kept for history.

Everything under `/admin` is gated to `UserRole.ADMIN` at two layers - the client (`AdminLayout` redirects non-admins to `/dashboard?denied=admin`) and the API (every `/api/admin/*` endpoint requires the ADMIN role). Sign in as `faizan.admin@gcr.dev` and use the **Admin** section of the sidebar, or visit the routes below directly.

**Dashboard (`/admin`)** - platform-wide stat tiles (users by role, classrooms, assignments, submissions, announcements), plus Archived classroom and Scheduled content statistics and a Platform activity feed (see [Dashboard Enhancements](#dashboard-enhancements)). The deeper analytics view - the platform-growth chart, a system-overview breakdown, and links into the six detailed reports - lives at `/admin/reports`, linked from the sidebar.

**Users (`/admin/users`)** - searchable/filterable/sortable/paginated user table. Create a user (a temporary password is generated and shown once), edit name/email/role, change status (Active/Inactive/Suspended/Archived - Locked is system-only, see Security), reset a password, or force a password change on next sign-in. Public self-registration is intentionally absent - every account originates here or from the seed script.

**Classrooms (`/admin/classrooms`)** - every classroom on the platform, regardless of owner. Archive/restore/delete (soft-delete), transfer ownership to another user by email, assign an additional teacher by email, and view per-classroom statistics (members, assignments, submissions) and its member list.

**Moderation (`/admin/moderation`)** - a single console for moderating Announcements, Comments, Materials, and Assignments across every classroom (switch content type via the dropdown). Archive, soft-delete, or restore any item; every action requires a confirmation dialog first.

**Reports (`/admin/reports`)** - the same stat tiles as the dashboard plus a platform-growth chart (weekly signups/classrooms, last 12 weeks) and a recent-activity feed, with links out to six detailed, filterable/sortable reports: Teacher Activity, Student Activity, Assignment Completion, Submission Rates, Classroom Activity, and Inactive Users. Every report returns a `{ columns, rows }` shape ready for a future CSV/PDF exporter (not built yet, by design).

**Audit Logs (`/admin/audit-logs`)** - a searchable, filterable, paginated trail of every administrative event: user create/update/role-change/suspend/password-reset, classroom archive, content moderation actions, account lock/unlock, and session termination. Filter by exact event type or search by actor/target.

**Settings (`/admin/settings`)** - platform-wide configuration: platform name (shown in both app and admin headers, and the page `<title>`), academic year, session timeout, max upload size, default classroom settings (applied to every newly created classroom), notification defaults, and the password policy (min length, uppercase/number/symbol requirements - enforced live on the self-service change-password form).

**Security (`/admin/security`)** - account-status breakdown, the current password policy, and three drill-down pages: **Active Sessions** (every currently valid signed-in session, with a real "Terminate" action - JWTs are stateless, so this is backed by a `UserLoginSession` table keyed by a session id embedded in the JWT and checked on every request), **Failed Login Attempts** (every unsuccessful sign-in, with email/IP/device), and **Locked Accounts** (auto-locked after 5 consecutive failed attempts; unlock or force a password reset from here).

### Admin manual testing walkthrough

A step-by-step path through every admin area, in the order it was built. Sign in as `faizan.admin@gcr.dev` / `F@izan4121` unless a step says otherwise. Every mutation below writes a real database row and shows a toast - nothing here is mocked.

**1. Access control**

- Signed out, visit `/admin` directly - redirected to `/login`.
- Signed in as the teacher or student seed account, visit `/admin` - redirected to `/dashboard?denied=admin` with an error toast; the **Admin** nav section is absent from their sidebar entirely.
- Signed in as the admin, `/admin` loads the dashboard inside its own shell (separate header/sidebar from the teacher/student app, same design system).

**2. Users (`/admin/users`)**

- Use the search box and the role/status filter dropdowns together, then click a column header to sort - the URL updates with `?q=`/`?role=`/`?status=`/`?sort=` and the table re-renders server-side.
- Click **Create user**, fill in name/email/role, submit - a one-time temporary-password dialog appears; copy it.
- Sign in as that new user with the temp password - you land on `/change-password` immediately (a new admin-created account always requires setting its own password first), not `/dashboard`.
- Back as admin, open a user's **⋮** menu: **Edit** (change name/email/role - changing role alone logs a different audit event than changing name/email, see step 7), **Reset password** (new temp password, same one-time dialog), **Force password change** (no new password yet, but their next sign-in redirects to `/change-password` the same way), and status changes (**Deactivate**/**Suspend**/**Archive**, each behind a confirmation dialog, plus **Reactivate** once inactive).
- Try deactivating or changing the role of your own admin account - it's blocked with an inline error (`CANNOT_MODIFY_SELF`); every other admin action can target any account, including other admins.

**3. Classrooms (`/admin/classrooms`)**

- The table lists every classroom platform-wide, not just ones you belong to - search/filter/sort/pagination work the same way as Users.
- Open **View details** on "Advanced Mathematics 101" - a side panel shows member/teacher/student counts, assignment/announcement/material/submission counts, and the full roster.
- **Archive** it (confirmation dialog first) - it disappears from the teacher's/students' classroom lists; **Restore** brings it back.
- **Transfer ownership** by typing another user's email (e.g. a student's) - that user becomes OWNER, the previous owner is downgraded to TEACHER.
- **Assign teacher** by email - adds that user as a TEACHER member without touching the owner.
- **Delete** (soft-delete) - same visual effect as Archive from the classroom's perspective, but tracked as a distinct action in the audit log.

**4. Moderation (`/admin/moderation`)**

- Switch the **Content type** dropdown between Announcements / Comments / Materials / Assignments - each renders its own columns (comments show a truncated content preview instead of a title).
- Pick any item's **⋮** menu: **Archive**, **Delete**, or **Restore** (whichever apply to its current status) - each requires confirming first, then the item's status badge updates and it disappears from the classroom it came from.
- Filter by status (Active/Archived/Deleted) to find something to restore after archiving/deleting it.

**5. Reports (`/admin/reports`)**

- The dashboard shows the same stat tiles as `/admin`, plus a 12-week platform-growth line chart (users + classrooms created per week) and a recent-activity feed.
- Follow the six report cards at the bottom into their own pages: **Teacher Activity**, **Student Activity**, **Assignment Completion**, **Submission Rates**, **Classroom Activity**, **Inactive Users**. Each supports search, a relevant filter (e.g. classroom or status), and click-to-sort column headers, independent of the others.
- On **Inactive Users**, lower the "days inactive" threshold to `0` - every seeded account (all created moments apart) should now appear, since none of them are older than that.

**6. Audit Logs (`/admin/audit-logs`)**

- After doing steps 2-4 above, open this page - you should see one row per action you just took (e.g. "User Created", "Role Changed", "Classroom Archived", "Assignment Deleted"), each with a timestamp, the admin as Actor, and a human-readable Target (a user's "Name (email)", a classroom's title, a content item's title/preview).
- Filter by one exact event type via the dropdown, or search by actor/target text - pagination applies once you have more rows than fit on one page.
- Note what's deliberately _not_ here: ordinary classroom activity like a student joining or submitting work lives in the same underlying table but is excluded from this view - only the fixed set of administrative events counts.

**7. Settings (`/admin/settings`)**

- Change **Platform name** and save - confirm it now shows in both the teacher/student app header and the admin header, and in the browser tab title.
- Toggle a **Default classroom setting** (e.g. turn off "Allow materials") and save, then create a new classroom (as the teacher, or via admin/classrooms is view-only for creation) - the new classroom's settings should reflect the value you just changed, not the old default.
- Tighten the **Password policy** (e.g. require a symbol, raise the minimum length) and save, then go to `/change-password` as any signed-in user and try a password that violates the new rule - it's rejected with the specific requirement that's missing.

**8. Security (`/admin/security`)**

- The overview shows live counts: active sessions, locked accounts, failed attempts in the last 24 hours, and the current password policy.
- Open **Active sessions** - your own current session is listed with its IP/device and expiry. Sign in as another seed account in a second browser (or incognito), find that session here, and **Terminate** it - the other browser gets signed out on its very next request (try refreshing it).
- Deliberately fail a sign-in 5 times in a row for one account (wrong password each time) - the 6th attempt fails even with the _correct_ password, because the account is now locked. Confirm it under **Locked accounts**.
- From **Locked accounts**, either **Unlock** it (sign-in works again immediately) or **Force a password reset** (generates a new temporary password and also clears the lock).
- Open **Failed login attempts** - your 5 deliberate failures (plus the 6th "correct password, still locked" one) are all listed with timestamps.

**9. Cross-check with Audit Logs**

- Go back to `/admin/audit-logs` - the lock from step 8 shows as "Account Locked" (attributed to the locked account itself, since it was system-triggered by its own failed attempts, not by an admin), and your unlock/terminate/reset actions each show up as their own event, all attributed to you as the actor.

## Performance

The target is page data in about 80ms, never over 100ms. Every page loads with one or two API calls (e.g. the Classwork tab returns topics, materials and assignments together; the Calendar returns the grid, today, upcoming and the month agenda together).

Measure it yourself:

```bash
docker compose exec server npm run latency
```

This signs in as each seeded role and requests every page-load endpoint, both straight from the database (cold cache, via a development-only `X-Cache-Bypass` header) and warm, then prints median/p95/max per endpoint and fails if any median exceeds 100ms. On the seeded data, uncached medians are 2-35ms and cached ones are 1-8ms.

Anything slower than 100ms in normal use is logged by the API (`[slow] GET ...`), and every response's `Server-Timing` header shows its server time in the browser's network panel.

## UI checks

Headless-browser checks run in a Playwright container (the stack must be running):

```bash
# Every page for every role at phone (390px), tablet (820px) and desktop (1440px):
# screenshots in tools/ui-check/out/, plus console errors, failed requests,
# horizontal overflow, API latency, and a check that hovering the sidebar sends no requests.
docker compose run --rm ui-check

# End-to-end user flows through the real UI (post/comment with live updates, create
# an assignment, turn in + grade + return, notifications, timetable, search,
# settings, avatar upload, admin user management):
docker compose run --rm ui-check node flows.mjs
```

On Git Bash for Windows, prefix commands that pass a `/path` argument with `MSYS_NO_PATHCONV=1`.

## Useful Commands

| Task                     | Command                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| Start / stop the stack   | `docker compose up -d` / `docker compose down`                    |
| Follow API logs          | `docker compose logs -f server`                                   |
| Seed demo data           | `docker compose exec server npm run seed`                         |
| Create a migration       | `docker compose exec server npx prisma migrate dev --name <name>` |
| Typecheck everything     | `docker compose exec server sh -c "cd /app && npm run typecheck"` |
| Format                   | `docker compose exec server sh -c "cd /app && npm run format"`    |
| Reset the database       | `docker compose down -v` (also clears installed node_modules)     |
| PostgreSQL from the host | `postgresql://gcr:gcr_password@localhost:5433/gcr_dev`            |

## API overview

All endpoints are under `/api`, return JSON, and (except login/config/health) require a session. Mutations return `{ status: "success", data }` or `{ status: "error", message, fieldErrors? }` with a matching HTTP status, and must send `X-Requested-With: gcr` (CSRF guard).

| Area          | Endpoints                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Auth          | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `GET /auth/config`                                        |
| Account       | `POST /account/password`, `GET /account/profile`, `POST /account/avatar`, `GET /avatars/:id`                            |
| Classes       | `/classrooms` (list, archived, detail, people, cover, create/update, join, archive/restore/leave, members, invitations) |
| Stream        | `/classrooms/:id/stream`, `/stream/version`, `/announcements`, `/comments`                                              |
| Classwork     | `/classrooms/:id/classwork`, `/topics`, `/materials`, `/assignments`                                                    |
| Submissions   | `/classrooms/:id/assignments/:id/submission-panel`, `/submission/*`, `/submissions/*`                                   |
| Scheduling    | `POST /scheduling/:type/:id/{schedule,cancel,publish}`, `POST /scheduling/publish-due`                                  |
| Aggregates    | `GET /dashboard`, `GET /todo`, `GET /review`, `GET /calendar`, `GET /search`                                            |
| Notifications | `GET /notifications`, `/unread-count`, `POST /open`, `/read-all`, `/:id/read`, `DELETE /:id`                            |
| Timetable     | `GET /timetable`, `/availability`, `/slots`, `/clashes` (admin)                                                         |
| Files         | `GET /files/:attachmentId` (`?download=1` to force download)                                                            |
| Admin         | `/admin/users`, `/admin/classrooms`, `/admin/audit-logs`, `/admin/settings`                                             |

## Folder Structure

- `server/prisma`: Prisma schema, migrations and seed script.
- `server/src/app.ts`: middleware stack and router mounting; `index.ts` starts the server (connect, warm up, scheduled-publish worker, listen).
- `server/src/features/<name>`: `services/`, `validation/`, `types`, `lib/` and `<name>.routes.ts` per feature - `auth`, `account`, `classroom`, `stream`, `classwork`, `submissions`, `scheduling`, `notifications`, `dashboard` (dashboard, to-do, review), `calendar`, `timetable`, `search`, `files`, `admin/{users,classrooms,audit-logs,settings}`.
- `server/src/lib`: Prisma client, tagged cache (`cache/`), auth helpers, storage providers, scheduling engine, audit log, system settings, warm-up.
- `server/src/middleware`, `server/src/http`: auth, CSRF, timing and error middleware; validation, upload and file-streaming helpers.
- `client/src/app`: routes, layouts (session gate and role guards), query/error views.
- `client/src/pages`: one component per route.
- `client/src/features/<name>`: feature components and `api.ts`.
- `client/src/components`: design-system primitives (`ui/`), app and admin shells, page scaffolding, empty/error/loading states.
- `client/src/lib`: axios client, query client, auth/session, navigation helpers, date and theme utilities.
- `shared/src`: enums, zod schemas, `ActionResult`, date helpers and file-upload rules shared by both sides.
- `docker/`, `Dockerfile`, `docker-compose*.yml`: development image, production image and stacks.

## Coding Standards

- Strict TypeScript on both sides; validate every request body and parameter with zod.
- Business rules and authorization live in the API's services - the client only hides controls the server would reject anyway.
- Pages fetch through TanStack Query hooks; mutations go through `apiAction` and return the shared `ActionResult` shape.
- Every mutation invalidates the cache tags it affects (`server/src/lib/cache/tags.ts`).
- Run the typecheck, the latency report and the UI checks before opening a pull request.

## Environment Variables

Local development needs none - `docker-compose.yml` sets them. For other environments see [.env.example](.env.example) and `server/src/config/env.ts`:

- `DATABASE_URL` - PostgreSQL connection string.
- `JWT_SECRET` - HS256 secret for session tokens (32+ random characters).
- `PORT` - API port (default 4000).
- `STORAGE_ROOT` - where uploaded files are stored (production image: `/data/uploads`).
- `SERVE_CLIENT_DIR` - serve the built React app from the API (set by the Dockerfile).
- `COOKIE_SECURE` - session cookie `Secure` flag (default: on in production).
- `SCHEDULED_PUBLISH_WORKER` - run the once-a-minute scheduled-content publisher (default on).
- `SLOW_REQUEST_MS` - slow-request log threshold (default 100).

## Deployment

The root `Dockerfile` builds one production image: it bundles the API with esbuild, builds the React app with Vite, and serves both from Express on `$PORT` (hashed assets cached for a year, the HTML shell never cached). On start it runs `prisma migrate deploy`.

- **Try it locally**: `JWT_SECRET=<random> docker compose -f docker-compose.prod.yml up --build -d`, then seed it and open http://localhost:8080.
- **Railway**: `railway.json` builds the Dockerfile and health-checks `/api/health`. Set `DATABASE_URL` and `JWT_SECRET`, and mount a volume at `/data` for uploads.
- When running more than one API instance, set `SCHEDULED_PUBLISH_WORKER=false` on all but one. The read cache is per process, so other instances can serve data up to 30-60 seconds old after a change.

## Future Modules

- A cloud storage provider for uploads (the `StorageProvider` interface in `server/src/lib/storage` is ready for it; local disk is the only driver today).
- CSV/PDF export for admin reports.
- A shared cache (e.g. Redis) if the API is scaled to several instances.
