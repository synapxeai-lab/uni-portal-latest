# Working in this repository

This project was migrated from Next.js to a separate **Express API** (`server/`) and **React SPA** (`client/`), with shared code in `shared/`. There is no Next.js anymore - don't reintroduce Next-specific APIs (`next/*`, Server Actions, `"use server"`, `"use cache"`).

- **No Node.js on the host.** Run everything through Docker Compose: `docker compose up -d`, then `docker compose exec server ...` / `docker compose exec client ...`, or `docker compose run --rm deps` after changing dependencies.
- **Server features** live in `server/src/features/<name>/` (`services/`, `validation/`, `<name>.routes.ts`). Validate every input with zod, put authorization in the services, and invalidate the right cache tags (`server/src/lib/cache/tags.ts`) in every mutation.
- **Client features** live in `client/src/features/<name>/` with an `api.ts` (TanStack Query hooks + mutation functions returning `ActionResult`). Pages are in `client/src/pages/` and registered in `client/src/app/routes.tsx`. Never prefetch on hover.
- **Performance budget:** page data in ~80ms, never over 100ms. Check with `docker compose exec server npm run latency`; add new page-load endpoints to `server/scripts/latency.ts`.
- **UI must stay identical across phone, tablet and desktop.** Check with `docker compose run --rm ui-check` (screenshots in `tools/ui-check/out/`) and `docker compose run --rm ui-check node flows.mjs`.
