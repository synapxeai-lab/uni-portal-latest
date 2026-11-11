# Working in this repository

The EITHM University Portal: the former University Portal (academic administration) and GCR (classrooms) combined into one Express API (`server/`) and React SPA (`client/`), with shared code in `shared/`. See README.md.

- **No Node.js on the host.** Run everything through Docker Compose: `docker compose up -d`, then `docker compose exec server ...` / `docker compose exec client ...`, or `docker compose run --rm deps` after changing dependencies.
- **Server features** live in `server/src/features/<name>/` (`services/`, `validation/` or schemas in the service, `<name>.routes.ts`). Validate every input with zod, put authorization in the services, and invalidate the right cache tags (`server/src/lib/cache/tags.ts`) in every mutation; university records use `invalidateUniversity()`.
- **University features** (`features/academics`): a course offered to a section (`SectionCourse`) owns a classroom; anything that changes offerings, teachers or registrations must keep it in sync through `lib/offering-classrooms.ts`. Self-service routes are under `/my/...`; teacher/admin access to one offering goes through `assertTeachesOffering`.
- **Client features** live in `client/src/features/<name>/` with an `api.ts` (TanStack Query hooks + mutation functions returning `ActionResult`). University queries use `useUniversityQuery` / `universityAction`. Pages are in `client/src/pages/` and registered in `client/src/app/routes.tsx`. Never prefetch on hover.
- **Performance budget:** page data in ~80ms, never over 100ms. Don't write on page-load reads. Check with `docker compose exec server npm run latency`; add new page-load endpoints to `server/scripts/latency.ts`.
- **Tests:** `docker compose exec server npm test` (vitest against the running API, seed accounts).
- **UI must stay identical across phone, tablet and desktop.** Check with `docker compose run --rm ui-check` (screenshots in `tools/ui-check/out/`); add new pages to `tools/ui-check/check.mjs`.
