# EITHM University Portal

One system for the Elevate Institute of Tourism & Hospitality Management. It combines the two apps the institute ran separately:

- the **University Portal**: programmes, diplomas, courses, batches, sections, teachers, students, registration, attendance, marks, grades, transcripts and fees;
- **GCR**: the Google Classroom-style platform with class streams, classwork, assignments and submissions, a review queue, calendar, timetable, search and notifications.

Everyone signs in once. Every course offered to a section has its own **classroom**. The classroom's roster follows the students registered for that course, and its teacher is the one assigned to it. Alongside Stream, Classwork and People, a course classroom has **Attendance** and **Marks** tabs.

## Technology

| Part | Stack |
| --- | --- |
| API | Node.js 22, Express 5, TypeScript, Prisma 7 (`pg` adapter), PostgreSQL 17, zod |
| Web app | React 19, Vite 7, React Router 7, TanStack Query 5, Tailwind CSS 4, Radix UI |
| Tooling | Docker Compose (no Node.js on the host), vitest, Playwright UI checks, esbuild |

Both legacy apps used PostgreSQL, Prisma, Express, React and Node.js. This project keeps that stack and follows GCR's structure, which was already TypeScript, Docker-only and built around a latency budget.

```
server/   Express API: features/<name>/ (routes, services, validation), lib/, prisma/
client/   React SPA: pages/, features/<name>/ (api.ts + components), components/
shared/   zod schemas, enums and types used by both
tools/    Playwright UI checks (screenshots per role and screen size)
migration/  script that copies the legacy databases in for the importer
```

The University Portal's features live in `server/src/features/academics` and `client/src/features/academics`, with their pages under `client/src/pages/university`. The link between the two halves is `server/src/features/academics/lib/offering-classrooms.ts`.

## Getting started

You need Docker Desktop (with Compose v2) and Git. You don't need Node.js.

```bash
docker compose up --build -d                 # database, API (port 4040) and web app (port 5180)
docker compose exec server npm run seed      # demo data
```

Open **http://localhost:5180** and sign in:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@eithm.edu.pk | Admin@12345 |
| Teacher | ayesha.khan@eithm.edu.pk | Teacher@123 |
| Teacher (visiting) | bilal.ahmed@eithm.edu.pk | Teacher@123 |
| Student | ali.raza@eithm.edu.pk | Student@123 |

The other demo accounts are listed in `server/prisma/seed/accounts.ts`. The seed only adds data and can be re-run at any time. It creates:

- a Tourism & Hospitality Management programme with two diplomas;
- teachers and students;
- an open Fall registration;
- course classrooms with demo classwork, plus attendance, marks and challans.

The stack uses its own host ports, so it runs alongside the two legacy apps: database 5440, API 4040, web 5180.

## Bringing over the legacy data

The two legacy apps' data is imported into a **freshly migrated** database. IDs are kept, so this has to come before the seed.

```bash
# 1. With the legacy apps' database containers running, copy both databases in
#    (dumps go to migration/dumps/, which git ignores):
sh migration/load-legacy.sh

# 2. Start from an empty, migrated database:
docker compose exec postgres psql -U portal -d postgres \
  -c "DROP DATABASE portal_dev WITH (FORCE);" -c "CREATE DATABASE portal_dev OWNER portal;"
docker compose exec server npx prisma migrate deploy

# 3. Import. Pass the University Portal's PASSWORD_ENC_KEY (or its JWT_SECRET
#    if it had none) so admins can still view its users' passwords:
docker compose exec -e LEGACY_UP_PASSWORD_ENC_KEY='<key>' server npm run db:import-legacy

# 4. Optionally add the demo data on top:
docker compose exec server npm run seed
docker compose restart server
```

What the import does:

- **GCR:** everything is copied as-is (accounts, classrooms, streams, classwork, submissions, comments, notifications, audit trail, rooms and settings), except login sessions.
- **University Portal accounts:** each becomes a login with the same password hash, so existing passwords keep working.
- **University Portal records:** programmes, diplomas, courses, sections, teachers and students (linked to their logins), offerings, registrations, attendance, assessment schemes, marks and grades.
- **Afterwards:** every imported offering gets its classroom, and every registration its challan.

## What each role gets

**Students**
- dashboard with current diploma and semester, credits, attendance, CGPA and fee due;
- course registration (credit limits, missed and failed courses offered again);
- My courses;
- each course's classroom (stream, classwork, submissions, their attendance and marks);
- to-do list, calendar and timetable;
- attendance, marks, transcript, and a printable fee challan (report payment, admin approves).

**Teachers**
- dashboard listing the course sections they teach, with direct links to each classroom's stream, attendance and marks;
- in each classroom: take attendance, keep the marks sheet (assessment items, marks entry, grading criteria, grade overrides), and use GCR's classwork, grading and review queue;
- generate and release grades for their own courses;
- calendar and timetable.

**Admins**
- **University:**
  - programmes and diplomas, courses (fees, extra fees, assessment schemes), batches and sections;
  - teachers and students (logins are created automatically);
  - offering courses and assigning teachers (each offering gets its classroom);
  - registration periods and credit limits, attendance overview, grade generation and release, fee challans and teachers' pay.
- **Platform:**
  - users (including viewing a user's password);
  - classrooms, timetable clashes, audit logs and settings.

## Performance

The target is page data in under 100 ms. Each page loads with one or two API calls. The API serves reads from a tag-invalidated in-memory cache, and each mutation clears exactly the tags it affects. The client caches page data with TanStack Query and never prefetches on hover. Work that the legacy portal did on every page load now runs only when something changes:

- challans are recalculated when fees or registrations change, not on every read;
- course offerings are an explicit admin action;
- the registration self-heal runs at most once a minute per student.

```bash
docker compose exec server npm run latency
```

This signs in as each role and times every page-load endpoint, cold (uncached) and warm, and fails if any median exceeds 100 ms. On the imported plus demo data, the slowest uncached median is about 14 ms and cached responses take 1–10 ms. Every response carries a `Server-Timing` header, and requests slower than 100 ms are logged.

## Tests and checks

```bash
docker compose exec server npm test                    # vitest: rules + API tests against the running API
docker compose exec server npm run typecheck
docker compose exec client npm run typecheck
docker compose run --rm ui-check                       # every page, every role, phone/tablet/desktop
docker compose run --rm ui-check node flows.mjs        # GCR end-to-end flows
```

On Git Bash for Windows, prefix commands that pass a `/path` with `MSYS_NO_PATHCONV=1`.

The API tests use the seed accounts and create, then remove, their own records. `tests/legacy-import.test.ts` checks the imported data and is skipped when there is none.

## Useful commands

| Task | Command |
| --- | --- |
| Start / stop | `docker compose up -d` / `docker compose down` |
| API logs | `docker compose logs -f server` |
| New migration | `docker compose exec server npx prisma migrate dev --name <name>` |
| Re-install after changing a package.json | `docker compose run --rm deps` |
| Database from the host | `postgresql://portal:portal_password@localhost:5440/portal_dev` |
| Reset everything | `docker compose down -v` |

## Configuration

Local development needs no `.env`, because `docker-compose.yml` sets everything. For other environments, see `.env.example` and `server/src/config/env.ts`:

- `DATABASE_URL`;
- `JWT_SECRET` (32+ characters);
- `PASSWORD_ENC_KEY` (encrypts the admin-viewable password copies; falls back to `JWT_SECRET`);
- `STORAGE_ROOT`;
- `COOKIE_SECURE`;
- `SCHEDULED_PUBLISH_WORKER`;
- `SLOW_REQUEST_MS`.

## Production

`Dockerfile` builds one image that serves the API and the built web app from the same origin. It applies pending migrations on start.

```bash
docker build -t portal .
docker compose -f docker-compose.prod.yml up --build      # app + PostgreSQL, http://localhost:8080
```

Mount a persistent volume at `/data` for uploaded files. Run the scheduled-publish worker on one instance only (`SCHEDULED_PUBLISH_WORKER=false` on the others).

To deploy on a VPS with Dokploy (for example Hostinger), see [docs/deploy-dokploy.md](docs/deploy-dokploy.md). It uses `docker-compose.dokploy.yml`, keeps uploads and the database in folders on the VPS disk, and adds `node dist/create-admin.js` for creating the first admin.

## History

The project was built module by module, one commit each:

1. foundation;
2. data model and sign-in;
3. academic structure;
4. people;
5. course offerings and their classrooms;
6. registration;
7. attendance;
8. marks and grades;
9. fees;
10. dashboards;
11. legacy data migration;
12. this hardening pass.

The two original apps' documents are kept in `docs/legacy/` for reference.
