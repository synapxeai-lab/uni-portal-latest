# Performance, caching & loading states

## Frontend data cache (TanStack Query)

All API reads go through one `QueryClient` (`apps/frontend/src/services/queryClient.js`).

- `useApiQuery(path, { keepPrevious })` is the React hook used by pages.
- `api.get(path)` is the same cache used imperatively. Callers such as roster loaders and
  modals keep working, but they still de-duplicate and reuse responses.
- **Key:** `['api', <signed-in user id>, <path incl. query string>]`. Search, filter and
  pagination variants are separate entries. Tokens never appear in keys.
- Search boxes are debounced by 250 ms (`hooks/useDebouncedValue.js`), so typing does
  not create a request or cache entry per keystroke.

### Freshness (`staleTime`, first match wins)

| Data | Paths | Fresh for |
|---|---|---|
| Attendance (marked live in class) | `…/attendance…` | 15 s |
| Dashboard counters | `/dashboard/*` | 30 s |
| Marks, grades, grading criteria | `…/marks…`, `…/grades…`, `…/grading…` | 30 s |
| Fee challans | `/challans*` | 30 s |
| Registration windows | `…registrations…` | 30 s |
| Own profile & courses | `/students/me`, `/teachers/me` | 60 s |
| People & sections lists | `/users`, `/teachers`, `/students`, `/sections` | 60 s |
| Reference catalogue | `/departments`, `/courses` | 5 min |
| Everything else | — | 30 s |

- Unused entries are garbage-collected after **10 minutes**.
- Stale queries refetch in the background on window focus or reconnect. The cached
  content stays on screen, and a thin gold bar at the top of the page shows the refresh.
- **Retries:** only network errors, 5xx and 429, at most twice. 4xx errors such as
  401, 403 and 404 are never retried.
- Fetches run with an `AbortSignal`, so cancelled queries abort their request.

### Invalidation

Every successful `POST`, `PUT` or `DELETE` (`api.post/put/delete`) marks **all of the
signed-in user's cached responses stale**:

- Views on screen refetch in the background.
- Other views refetch the next time they open.

This is intentionally broad. Records in this system are tightly coupled: a registration
changes sections, challans, marks rosters and dashboard counts, and a section edit changes
course, teacher and student views. A hand-maintained dependency map would eventually leave
some view stale.

Where a mutation returns the updated record, the page also writes it into the cache
straight away (`updateApiData`), so the UI updates without waiting for the refetch. This
covers challan approve/pay, delete rows, section edits, grade and criteria saves, and
registration. These are server-confirmed updates, not optimistic ones, so no rollback is
needed. No optimistic updates are used: approvals, payments and grade changes are
irreversible or high-stakes.

### Authentication & privacy

- The cache lives **in memory only**. Nothing is persisted to localStorage or IndexedDB.
- The cache is **cleared** on login and on logout, and keys are scoped by user id, so one
  account's data can never be shown to another, even in the same tab.
- `/auth/*` is never cached and never triggers invalidation.

## HTTP caching

- **API** (`apps/backend/index.js`): every `/api/*` response sends
  `Cache-Control: private, no-store` and `Vary: Origin, Authorization`. All of these
  responses are authenticated and personal (marks, fees, CNICs), so browsers and shared
  proxies/CDNs must not store them.
- **Static assets** (`apps/frontend/nginx/default.conf.template`):
  - Vite's content-hashed `/assets/*` files get `public, max-age=31536000, immutable`.
  - Branding images under `/assets/branding/*` have stable names, so they get one day
    plus `stale-while-revalidate`.
  - `index.html` is served with `no-cache`, so a new deploy is picked up immediately.
- **Compression**: the frontend's nginx gzips CSS, JS, SVG and JSON, which includes
  API responses proxied through `/api`. No compression middleware was added to Express.
- No Redis or server-side response cache was added. There was no measured bottleneck,
  and the responses are user-specific.

## Code splitting

Every page is loaded on demand with `React.lazy`. The initial JS dropped from about
1,066 kB to about 507 kB (gzip: 207 kB to 143 kB).

React Router's `v7_startTransition` keeps the current page visible while the next chunk
loads. The shell skeleton only appears on a cold first load.

## Skeleton loading

The primitives live in `components/Skeleton.jsx`:

- `Skeleton`, `SkeletonText`, `SkeletonRegion`
- `PageHeaderSkeleton`, `BackLinkSkeleton`, `FiltersSkeleton`, `PillsSkeleton`, `TabsSkeleton`
- `StatCardsSkeleton`, `WelcomeBannerSkeleton`, `ProfileCardSkeleton`, `ProfileFieldsSkeleton`
- `ListRowsSkeleton`, `CourseRowsSkeleton`, `CardGridSkeleton`, `DetailHeaderSkeleton`, `SectionBlockSkeleton`
- `TableSkeleton` (pass `bare` to render inside an existing `.table-card`), `FormSkeleton`
- `AppShellSkeleton` (`components/AppShellSkeleton.jsx`): sidebar, header and content
  while a session restores or a chunk loads

Rules:

- Each page composes a skeleton from the **same layout classes** as its real content
  (`.dept-row`, `.course-card`, `.table-card`, `.stats-grid`, …), which keeps layout
  shift minimal.
- Skeletons show **only for the initial load** (`isPending`). Background refetches keep
  the content visible. Filter changes keep the previous results, dimmed, until the new
  ones arrive.
- Skeletons **fade in after 120 ms**, so requests that finish faster never flash
  placeholders.
- Accessibility: one `role="status"` with a "Loading …" label per region. Every
  decorative block is `aria-hidden`.
- Under `prefers-reduced-motion`, the shimmer and fade are turned off.
- Failures render `ErrorState` (`components/ErrorState.jsx`) with a **Try again**
  button. Empty results render the page's empty state, never an endless skeleton.

## Images

- The logo is preloaded in `index.html`.
- The logo has explicit `width`/`height` and `aspect-ratio`, uses `fetchpriority="high"`,
  and is never lazy-loaded.
- The crest is lazy-loaded wherever it starts hidden (collapsed sidebar only).

## Verifying

- In DevTools → Network, revisit a page within its fresh window: no new request is sent.
- Save something, and the visible lists refetch once.
- Log out and log in as another user: every request is fresh.
- `/api/*` response headers show `Cache-Control: private, no-store`.
