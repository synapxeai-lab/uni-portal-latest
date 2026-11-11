# UI Architecture

This document is the blueprint for GCR's classroom UI. It analyzes Google Classroom's interaction patterns, defines the component hierarchy and folder structure our team will build against, and locks in a design system so every future feature looks and behaves like one product. It is planning only — no components or pages are created by this document.

It builds directly on the application shell already implemented (`src/components/shell/`, `src/components/ui/`, `src/components/page/`, `src/components/states/`, `src/app/(app)/layout.tsx`). That work is treated as the foundation layer below; everything else here is planned, not yet built.

## 1. Reference analysis: Google Classroom UI patterns

This is a structural/behavioral analysis, not a visual copy. No proprietary assets, icons, or brand marks are reused — only the interaction patterns and layout logic.

| Area                    | Pattern observed                                                                                                                                                                                                                                                                                                                                                                                                              | Implication for GCR                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Header**              | Fixed top bar: hamburger, wordmark, search (grows to fill space on desktop, collapses to an icon on narrow widths), app-switcher-style icon cluster, notification bell, circular avatar with initials/photo. Search is a first-class, always-visible affordance, not hidden behind a page.                                                                                                                                    | Matches our existing `Header` — hamburger toggles sidebar collapse (desktop) or drawer (mobile); search stays visible ≥`md`, icon-only below it.                                                                               |
| **Sidebar**             | Left rail, two states: expanded (~256px, icon + label) and collapsed (~72px, icon only, tooltip on hover). Sections: Home/Calendar/Teaching-or-Enrolled/To-review (teacher only)/Archived classes, then a scrollable list of enrolled classes each with a small color swatch. No sidebar on mobile — replaced entirely by a drawer.                                                                                           | Matches our existing `Sidebar`/`MobileNav`. The class list under the nav sections is new: a scrollable "your classes" block rendered from real membership data, with a color chip per classroom (see §6 Color palette).        |
| **Dashboard ("Home")**  | Grid of classroom cards, most-recent-activity first. Each card: color banner (teacher photo or flat color), class title, section, teacher name, small overflow menu, and a body area showing the latest stream item or "no work due". Empty state ("no classes yet") offers Join/Create actions.                                                                                                                              | Maps to `ClassroomCard` + `ClassroomCardGrid`, backed by `ClassroomMembership` + `Classroom`. Our current dashboard placeholder (`StatGrid`/`StatCard`) becomes the summary strip _above_ this grid, not a replacement for it. |
| **Stream**              | Chronological feed inside a classroom: pinned announcements first, then reverse-chronological posts. A composer ("Share something with your class...") sits at the top for teachers. Each post: author avatar, timestamp, body, attachments, comment count, and an inline comment thread that expands on click.                                                                                                               | `AnnouncementComposer` + `AnnouncementCard` + `CommentThread`. Maps to `Announcement` + `Comment` (visibility: PUBLIC).                                                                                                        |
| **Classwork**           | Grouped by `Topic`, most recent topic first, with an ungrouped section for items without a topic. Each row: type icon (assignment/material/question), title, due date, points. A "+ Create" button opens a menu (Assignment / Material / Question / Topic) that leads to a full create form (dialog on desktop, full-screen route on mobile).                                                                                 | `TopicAccordion` containing `AssignmentCard` / `MaterialCard` rows, plus `CreateWorkMenu`. Maps to `Topic` + `Assignment` + `Material`.                                                                                        |
| **People**              | Two sections: Teachers, Students — each a simple list (avatar, name, email), with a per-row overflow menu (remove, email) for teachers/admins. An "Invite" action opens a dialog with an email field or shareable class code.                                                                                                                                                                                                 | `PeopleSection` + `PersonRow` + `InvitePeopleDialog`. Maps to `ClassroomMembership` + `Invitation`.                                                                                                                            |
| **Assignment detail**   | Split view: instructions/attachments on the left (student) or center (teacher), submission/grading panel on the right. Student view: "Your work" card with attach/turn-in controls and status (Assigned/Submitted/Late/Returned). Teacher view: roster-style list of submissions with per-student status and a grading side panel (grade, private comment).                                                                   | `AssignmentInstructions` + `SubmissionPanel` (student) + `SubmissionsList` + `GradingSidebar` (teacher). Maps to `Assignment` + `Submission` + `Comment` (visibility: PRIVATE).                                                |
| **Forms**               | Simple, single-column, generous label spacing, inline validation messages, primary action bottom-right, secondary/cancel to its left. Long forms (assignment create) live in a dedicated full-page or large-dialog surface rather than a small modal.                                                                                                                                                                         | Standardize on `react-hook-form` + `zod` (already dependencies) driving shadcn-style `Form`, `FormField`, `FormLabel`, `FormMessage` wrappers around our `Input`/`Textarea`/`Select`.                                          |
| **Dialogs**             | Centered modal, rounded corners, header + body + right-aligned footer actions. Destructive actions (delete/unenroll) use a smaller, copy-heavy confirmation dialog. On mobile, dialogs typically become full-height sheets.                                                                                                                                                                                                   | New `Dialog` primitive (Radix Dialog — already a dependency via `Sheet`) + `AlertDialog` for destructive confirmations. Reuse `Sheet` on mobile breakpoints where Classroom uses a full-height surface.                        |
| **Menus**               | Small overflow (⋮) menus on cards/rows for contextual actions (edit, delete, copy link, archive). Consistent placement top-right of the card/row.                                                                                                                                                                                                                                                                             | Reuse our existing `DropdownMenu` primitive — same one powering `UserMenu`/`NotificationsMenu` today.                                                                                                                          |
| **Empty states**        | Friendly illustration + one-line title + short supporting copy + a single primary action ("Create class", "Nothing due this week"). Never a bare blank page.                                                                                                                                                                                                                                                                  | Reuse existing `EmptyState` component everywhere a list/collection can be zero-length.                                                                                                                                         |
| **Loading states**      | Skeleton placeholders shaped like the eventual content (card outlines, list rows) rather than spinners, so layout doesn't jump.                                                                                                                                                                                                                                                                                               | Reuse existing `CardSkeleton` / `CardGridSkeleton` / `ListSkeleton` / `PageSkeleton`; add feature-specific skeletons only if the shape genuinely differs (e.g. a stream-post skeleton).                                        |
| **Error states**        | Rare in-product; mostly network-error banners or a full-page "Something went wrong" with retry.                                                                                                                                                                                                                                                                                                                               | Reuse existing `ErrorState` + the `(app)/error.tsx` boundary pattern; add nested `error.tsx` at the classroom-detail segment so one classroom's failure doesn't take down the whole shell.                                     |
| **Responsive behavior** | Sidebar → drawer below desktop width. Two/three-column dashboard grid collapses to one column. Classroom tabs (Stream/Classwork/People) become a horizontally scrollable pill row on narrow screens. Split assignment-detail view stacks vertically on mobile, grading panel becomes a bottom sheet. A floating "+" action button appears bottom-right on mobile where a header button would otherwise be too small a target. | Detailed in §8.                                                                                                                                                                                                                |

## 2. Current foundation (already implemented — reuse, don't rebuild)

| Component                              | Location                                             | Responsibility                                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Shell`                                | `src/components/shell/shell.tsx`                     | Top-level authenticated layout orchestrator. Wires `TooltipProvider` + `SidebarProvider`, renders `Header`, `Sidebar`, `MobileNav`, and the page `main` slot.                           |
| `Header`                               | `src/components/shell/header.tsx`                    | Sticky top bar: nav toggle, brand mark, `SearchBar`, `NotificationsMenu`, `UserMenu`.                                                                                                   |
| `Sidebar` / `MobileNav`                | `src/components/shell/sidebar.tsx`, `mobile-nav.tsx` | Desktop collapsible rail vs. mobile `Sheet` drawer, both driven by the same `NavList`/`nav-config`.                                                                                     |
| `NavList` / `nav-config`               | `src/components/shell/nav-list.tsx`, `nav-config.ts` | Role-filtered navigation items with active-route highlighting. This is the pattern the future "your classes" sidebar list plugs into.                                                   |
| `UserMenu`                             | `src/components/shell/user-menu.tsx`                 | Avatar dropdown: profile, settings, sign out.                                                                                                                                           |
| `NotificationsMenu`                    | `src/components/shell/notifications-menu.tsx`        | Bell icon + dropdown, currently UI-only empty state — wires to `Notification` model in a later phase.                                                                                   |
| `SearchBar`                            | `src/components/shell/search-bar.tsx`                | UI-only header search input — wires to a real query in a later phase.                                                                                                                   |
| `Breadcrumbs`                          | `src/components/shell/breadcrumbs.tsx`               | Server-renderable breadcrumb trail, consumed via `SectionHeader`.                                                                                                                       |
| `PageContainer`                        | `src/components/page/page-container.tsx`             | Max-width, responsive-gutter wrapper for every page body.                                                                                                                               |
| `SectionHeader`                        | `src/components/page/section-header.tsx`             | Title + description + breadcrumbs + action slot, used at the top of every page.                                                                                                         |
| `DashboardGrid` / `StatGrid`           | `src/components/page/dashboard-grid.tsx`             | Generic responsive grid wrappers.                                                                                                                                                       |
| `StatCard`                             | `src/components/page/stat-card.tsx`                  | Generic KPI tile (label/value/icon).                                                                                                                                                    |
| `EmptyState` / `ErrorState`            | `src/components/states/`                             | Reusable zero-data and failure surfaces.                                                                                                                                                |
| Skeletons                              | `src/components/states/skeletons.tsx`                | `CardSkeleton`, `CardGridSkeleton`, `ListSkeleton`, `PageHeaderSkeleton`, `PageSkeleton`.                                                                                               |
| UI primitives                          | `src/components/ui/`                                 | `Button`, `Card`, `Badge`, `Input`, `Separator`, `Avatar`, `DropdownMenu`, `Sheet`, `Tooltip`, `Skeleton` — shadcn-style, built on Radix, driven by the design tokens in `globals.css`. |
| `(app)/layout.tsx`                     | `src/app/(app)/layout.tsx`                           | Session-gated root layout that renders `Shell`; every authenticated route lives under this group.                                                                                       |
| `(app)/loading.tsx`, `(app)/error.tsx` | `src/app/(app)/`                                     | Route-group-level Suspense fallback and error boundary.                                                                                                                                 |

## 3. Component hierarchy (planned)

```
AppShell (existing: Shell)
├─ Header (existing)
│  ├─ SearchBar (existing, UI-only → wire in Phase 7)
│  ├─ NotificationsMenu (existing, UI-only → wire in Phase 7)
│  └─ UserMenu (existing)
├─ Sidebar / MobileNav (existing)
│  └─ ClassList (new, Phase 1) — scrollable list of joined classes with color chips, rendered below NavList
└─ main
   └─ PageContainer (existing)
      └─ SectionHeader (existing)
      └─ <route content>

Dashboard (Phase 1)
├─ StatGrid / StatCard (existing, wire to real counts)
├─ ClassroomCardGrid (new)
│  └─ ClassroomCard (new)
└─ EmptyState (existing) — "no classes yet" with Join/Create actions

Classroom detail shell (Phase 2)
├─ ClassroomHeader (new) — banner, title, section, code, overflow menu
├─ ClassroomTabs (new) — Stream / Classwork / People / (Grades, teacher-only, later)
└─ <tab content, one nested layout per src/app/(app)/classes/[classroomId]/>

Stream (Phase 3)
├─ AnnouncementComposer (new, teacher/co-teacher only)
├─ AnnouncementCard (new)
│  └─ CommentThread → CommentInput (new)
└─ EmptyState / ListSkeleton (existing, reused)

Classwork (Phase 4)
├─ CreateWorkMenu (new) — dropdown → CreateAssignmentDialog / CreateMaterialDialog / CreateTopicDialog
├─ TopicAccordion (new)
│  ├─ AssignmentCard (new)
│  └─ MaterialCard (new)
└─ EmptyState / ListSkeleton (existing, reused)

People (Phase 5)
├─ PeopleSection (new) — "Teachers" / "Students" groupings
│  └─ PersonRow (new)
└─ InvitePeopleDialog (new)

Assignment detail (Phase 6)
├─ AssignmentInstructions (new)
├─ Student view: SubmissionPanel (new) — attach work, turn in, status badge
└─ Teacher view: SubmissionsList (new) → GradingSidebar (new) — grade + private comment

Admin area (Phase 8)
├─ UsersTable (new, uses new Table primitive)
├─ ClassroomsTable (new)
└─ ReportsPanel (new)

Cross-cutting primitives (new, needed once forms/dialogs appear)
├─ Dialog, AlertDialog (Radix Dialog wrapper, sibling to existing Sheet)
├─ Form, FormField, FormLabel, FormMessage (react-hook-form + zod wrapper)
├─ Textarea, Select, Checkbox, RadioGroup (shadcn-style, token-driven)
└─ Table, TableHeader, TableRow, TableCell (for People/Admin rosters)
```

### Component responsibility notes

- **ClassroomCard** — pure presentation, takes a `Classroom` + the current user's membership role as props; renders differently for owner/teacher (shows class code, manage affordance) vs. student (shows teacher name). No data fetching inside the component.
- **ClassroomHeader / ClassroomTabs** — live in `src/app/(app)/classes/[classroomId]/layout.tsx`, not a client-side tab switcher; each tab is a real route so the browser back button and deep links work, matching Classroom's own URL-per-tab behavior.
- **TopicAccordion** — groups already-fetched classwork items client-side by `topicId`; expansion state is local UI state, not persisted.
- **SubmissionPanel vs. SubmissionsList** — same route (`/classes/[classroomId]/classwork/[assignmentId]`), branch on the viewer's `ClassroomMembershipRole` (student sees their own panel; teacher/co-teacher/assistant sees the roster).
- **Dialog vs. Sheet** — `Dialog` (centered) is for short, single-purpose actions (confirm, invite, rename). `Sheet` (edge-anchored, already built) is for longer forms and is also the mobile fallback surface for anything that would otherwise be a centered dialog on a small screen.

## 4. Folder structure

```
src/
  app/
    (app)/                        # authenticated route group — gated by src/app/(app)/layout.tsx
      dashboard/
      classes/
        page.tsx                  # classroom list (all classes)
        [classroomId]/
          layout.tsx              # ClassroomHeader + ClassroomTabs, fetches the classroom once
          page.tsx                # redirects to /stream (matches Classroom's own behavior)
          stream/
          classwork/
            [assignmentId]/
          people/
          settings/                # teacher/owner only
      archived/
      calendar/
      review/                     # teacher "to review" queue, cross-classroom
      admin/
        users/
        classrooms/
        reports/
      profile/
      settings/
    (auth)/
      login/
      register/
    api/
  components/
    ui/                           # shadcn-style primitives — token-driven, zero business logic
    shell/                        # app chrome: header, sidebar, nav, breadcrumbs, user/notifications menus
    page/                         # page-composition primitives: PageContainer, SectionHeader, grids, StatCard
    states/                       # EmptyState, ErrorState, skeletons — cross-feature, zero business logic
    layouts/                      # non-authenticated layouts (existing marketing AppShell)
  features/                       # feature-owned UI + hooks, one folder per domain slice
    dashboard/
      components/                 # ClassroomCardGrid, ClassroomCard
      hooks/                      # useDashboardClasses, etc.
    classroom/
      components/                 # ClassroomHeader, ClassroomTabs
      hooks/
    stream/
      components/                 # AnnouncementComposer, AnnouncementCard, CommentThread
      hooks/
    classwork/
      components/                 # TopicAccordion, AssignmentCard, MaterialCard, CreateWorkMenu
      hooks/
    assignments/
      components/                 # AssignmentInstructions, SubmissionPanel, SubmissionsList, GradingSidebar
      hooks/
    people/
      components/                 # PeopleSection, PersonRow, InvitePeopleDialog
      hooks/
    admin/
      components/                 # UsersTable, ClassroomsTable, ReportsPanel
      hooks/
  lib/
    auth/                         # existing permissions helpers
    validation/                   # new: zod schemas per feature (assignment, announcement, invitation forms)
  hooks/                          # cross-feature hooks (e.g. useMediaQuery, useDebouncedValue)
  types/                          # shared UI-facing types not generated by Prisma
```

**Why this split:**

- **`components/` vs. `features/`** — `components/` holds things with no opinion about classrooms, assignments, or roles (a `Button` doesn't know what an `Assignment` is). `features/` holds things that _do_ know the domain. This is the line that keeps `components/ui` reusable outside this product and keeps feature code from leaking into shared primitives.
- **`components/ui` vs. `components/shell` vs. `components/page` vs. `components/states`** — already established by the shell work; kept as-is because it separates _design-system primitives_ (`ui`), _app chrome_ (`shell`), _page-composition scaffolding_ (`page`), and _cross-feature UX states_ (`states`) — four different reasons a component might change.
- **`features/<name>/components` + `features/<name>/hooks`** — each feature owns its presentational components and its data-fetching hooks together, so a feature can be understood (and eventually code-split or deleted) as one unit. Routes in `app/` stay thin: a page imports from `features/*` and composes it inside `PageContainer`/`SectionHeader`.
- **`lib/validation/`** — form schemas are shared between the client form and (eventually) server actions/route handlers validating the same payload; centralizing them avoids duplicating validation rules.
- **One feature folder per Prisma domain concept** (`stream` → `Announcement`/`Comment`, `classwork` → `Topic`/`Material`/`Assignment`, `people` → `ClassroomMembership`/`Invitation`) — keeps the UI's mental model aligned with `prisma/schema.prisma`, so a new contributor can find the UI for a model by name.

## 5. Design system

Built on the tokens already defined in `src/app/globals.css` (`@theme inline`) — this section documents them and fills the gaps needed for classroom features.

### Typography

Font: Geist Sans (`--font-geist-sans`) for UI text, Geist Mono for code/IDs — already wired in `src/app/layout.tsx`. No new font is introduced.

| Role               | Classes                                                           | Usage                                       |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------- |
| Page title         | `text-2xl font-semibold tracking-tight`                           | `SectionHeader` title (existing convention) |
| Section/card title | `text-base font-semibold`                                         | `CardTitle` (existing convention)           |
| Body               | `text-sm`                                                         | Default body copy, list rows, form labels   |
| Supporting/meta    | `text-sm text-muted-foreground` / `text-xs text-muted-foreground` | Descriptions, timestamps, hints             |
| Numeric emphasis   | `text-2xl font-semibold`                                          | `StatCard` value (existing convention)      |

### Color palette

Semantic tokens already live in `globals.css` (light + `prefers-color-scheme: dark`): `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar*`. Feature work should reach for these tokens (`bg-card`, `text-muted-foreground`, `border-border`, etc.), never raw Tailwind grays.

Two additions are needed for classroom features and don't exist yet:

- **Status tokens** — `success` / `warning` / `info` (submission states: returned/late/pending). Add as the same `--color / --color-foreground` pair pattern already used for `destructive`.
- **Class accent palette** — a fixed rotation of 6–8 hues (e.g. indigo, teal, amber, rose, violet, emerald, sky, orange) assigned deterministically per classroom (hash of `classroom.id`) for the `ClassroomCard` banner and sidebar color chip — mirrors Classroom's per-class color without copying its exact palette. Defined as a small constant array in `features/classroom/`, not as global CSS tokens, since it's a rotation rather than a semantic color.

### Spacing scale

Tailwind's default 4px grid, used consistently at these steps: `gap-1`/`gap-1.5` (tight, within a row), `gap-2`/`gap-3` (related controls), `gap-4`/`gap-6` (cards in a grid, sections on a page), `py-6`/`px-4 sm:px-6 lg:px-8` (page gutters — already `PageContainer`'s convention). New feature components should reuse these steps rather than introducing new ones.

### Border radius

`--radius: 0.75rem` drives `radius-sm/md/lg/xl`. Convention already in use: cards/dialogs/dropdowns `rounded-xl`, buttons `rounded-full` (pill, matching Classroom's action buttons), inputs/textareas `rounded-md`, avatars/chips `rounded-full`.

### Shadows / elevation

Flat by default (`border` + `bg-card`, no shadow) at rest; `shadow-sm` on floating surfaces (dropdown/dialog content); `hover:shadow-md` transition on interactive cards (`ClassroomCard`, `AssignmentCard`) — already the pattern in `StatCard`. No elevation above `shadow-lg` anywhere (matches Classroom's restrained, mostly-flat surface language).

### Icons

`lucide-react` exclusively, stroke-based, sized `h-4 w-4` inline/tight contexts and `h-5 w-5` in nav/header — already the convention in `Header`/`NavList`. One icon per concept, never mixed with emoji.

### Button variants

Already defined in `src/components/ui/button.tsx`: `default` (primary, filled), `secondary`, `outline`, `ghost` (icon buttons in header/rows), `destructive`, `link`; sizes `default/sm/lg/icon`. No new variants needed — feature work should compose these, not add one-off button styles.

### Form styling

New `Form`/`FormField`/`FormLabel`/`FormMessage` wrapper around `react-hook-form` + `zod` (both already dependencies), styled consistently with existing `Input`: `rounded-md border-input bg-card`, error state swaps border/ring to `destructive`, helper/error text `text-xs`. Primary action bottom-right, cancel/secondary to its left — matches the analyzed Classroom pattern.

### Card styling

`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter` (existing) is the base every feature card composes: `ClassroomCard`, `AssignmentCard`, `AnnouncementCard` are all `Card` plus feature-specific content, not new primitives.

### Tables

New `Table` primitive (shadcn convention: `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`), needed for the People roster (dense variant) and Admin Users/Classrooms views. Row hover uses `hover:bg-accent`, matching dropdown/nav hover treatment for consistency.

### Lists

Non-tabular rows (notifications, submissions, search results) follow one shared shape: `flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50` — already the exact shape used in `ListSkeleton`, so the loading state and loaded state match pixel-for-pixel.

### Dialogs

New `Dialog` (centered, Radix Dialog — sibling implementation to the already-built `Sheet`, same primitive family) for short actions; `AlertDialog` (Radix Alert Dialog, new dependency) specifically for destructive confirmations, so accidental Escape/overlay-click dismissal is disabled where it shouldn't be possible.

## 6. Routing plan

All authenticated routes live under the existing `(app)` route group and inherit `Shell` automatically. Route-level `loading.tsx`/`error.tsx` are added per segment listed below where the segment fetches its own data, so one failure/slow load doesn't affect siblings.

| Route                                             | Purpose                                                    | Access                                     | Data source                                |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `/`                                               | Public marketing landing (existing)                        | Public                                     | —                                          |
| `/login`, `/register`                             | Auth flows (existing)                                      | Public, redirects away if authenticated    | `User`                                     |
| `/dashboard`                                      | Home: stat strip + joined-classes grid                     | Authenticated                              | `ClassroomMembership`, `Classroom`         |
| `/classes`                                        | Full classroom list (all joined/owned classes, filterable) | Authenticated                              | `ClassroomMembership`, `Classroom`         |
| `/classes/[classroomId]`                          | Redirects to `/classes/[classroomId]/stream`               | Member of that classroom                   | `Classroom` (existence + membership check) |
| `/classes/[classroomId]/stream`                   | Announcement feed                                          | Member                                     | `Announcement`, `Comment`                  |
| `/classes/[classroomId]/classwork`                | Topics + assignments + materials                           | Member                                     | `Topic`, `Assignment`, `Material`          |
| `/classes/[classroomId]/classwork/[assignmentId]` | Assignment detail; branches student/teacher view           | Member                                     | `Assignment`, `Submission`, `Comment`      |
| `/classes/[classroomId]/people`                   | Roster + invite                                            | Member (invite action: teacher/owner only) | `ClassroomMembership`, `Invitation`        |
| `/classes/[classroomId]/settings`                 | Classroom settings (name, code, permissions)               | Owner/teacher only                         | `Classroom`, `ClassroomSettings`           |
| `/archived`                                       | Archived classes                                           | Authenticated                              | `Classroom` (status: ARCHIVED)             |
| `/calendar`                                       | Due dates across all classes                               | Authenticated                              | `Assignment` (aggregated)                  |
| `/review`                                         | Cross-classroom "to review" queue                          | Teacher/Admin                              | `Submission` (status: SUBMITTED)           |
| `/admin/users`                                    | User management                                            | Admin only                                 | `User`                                     |
| `/admin/classrooms`                               | Classroom oversight                                        | Admin only                                 | `Classroom`                                |
| `/admin/reports`                                  | Platform analytics                                         | Admin only                                 | Aggregated                                 |
| `/profile`                                        | Own profile                                                | Authenticated                              | `User`                                     |
| `/settings`                                       | Account settings                                           | Authenticated                              | `User`                                     |

Role gating reuses the existing `src/lib/auth/permissions.ts` helpers (`requireRole`, `canAccessAdminArea`, `canAccessTeacherArea`) at the layout/page level, and the existing `nav-config.ts` `roles` filter for what's _visible_ in navigation — the same pattern already used for the Admin nav section today, extended to Teacher-only items like "To review".

## 7. Responsive strategy

Breakpoints follow Tailwind defaults already in use throughout the shell: `sm` 640px, `md` 768px, `lg` 1024px (the sidebar/drawer threshold).

|                             | Desktop (`≥lg`)                                                                              | Tablet (`sm`–`lg`)                                                                     | Mobile (`<sm`)                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**                 | Persistent rail, expanded (256px) or collapsed (72px, toggle in header) — existing `Sidebar` | Hidden; hamburger opens `MobileNav` drawer — existing behavior, threshold already `lg` | Same as tablet                                                                                                                    |
| **Header search**           | Inline input, `md:flex` — existing                                                           | Inline input                                                                           | Icon-only button (opens a future full-width search overlay) — existing `md:hidden` fallback already stubbed                       |
| **Dashboard grid**          | 3–4 columns (`StatGrid`/future `ClassroomCardGrid`)                                          | 2 columns                                                                              | 1 column                                                                                                                          |
| **Classroom tabs**          | Standard tab row under `ClassroomHeader`                                                     | Standard tab row                                                                       | Horizontally scrollable pill row (`overflow-x-auto`, snap) so all tabs stay reachable without a menu                              |
| **Assignment detail**       | Two-column split (instructions + submission/grading panel)                                   | Two-column, narrower panel                                                             | Single column, stacked; grading panel becomes a `Sheet` opened from a "Grade" button rather than always-visible                   |
| **Dialogs**                 | Centered `Dialog`, fixed max-width                                                           | Centered `Dialog`                                                                      | Long forms use `Sheet` (bottom or full-height) instead of a centered dialog; short confirmations stay as a centered `AlertDialog` |
| **Primary "create" action** | Button in `SectionHeader` actions slot                                                       | Same                                                                                   | Floating action button, fixed bottom-right, for Classwork/Stream create actions where a header button would be too small a target |
| **Tables (People/Admin)**   | Full `Table`                                                                                 | Full `Table`, horizontal scroll if needed                                              | Row-card layout (each row becomes a stacked mini-card) instead of a table, reusing the existing list-row shape from §5            |

All of the above is additive to what's already built — `PageContainer`'s `px-4 sm:px-6 lg:px-8` and the existing grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4` utilities are the baseline every new feature grid should copy rather than reinvent.

## 8. Future implementation order

1. **Dashboard data wiring** — `ClassroomCardGrid`/`ClassroomCard`, wire `StatGrid` to real counts, `/classes` list page. No writes yet, read-only.
2. **Classroom shell** — `ClassroomHeader`, `ClassroomTabs`, `[classroomId]/layout.tsx`, join-by-code and create-classroom dialogs. Introduces the `Dialog`/`Form` primitives everything after this depends on.
3. **Stream** — `AnnouncementComposer`, `AnnouncementCard`, `CommentThread`. First read/write feature end-to-end.
4. **Classwork** — `TopicAccordion`, `AssignmentCard`/`MaterialCard`, `CreateWorkMenu` + create dialogs/forms.
5. **People** — `PeopleSection`, `PersonRow`, `InvitePeopleDialog`. Introduces the `Table` primitive (or list-row variant on mobile).
6. **Assignment detail & submissions** — `AssignmentInstructions`, `SubmissionPanel` (student), `SubmissionsList` + `GradingSidebar` (teacher).
7. **Notifications & search wiring** — connect the already-built `NotificationsMenu` and `SearchBar` UIs to real `Notification` data and a real query, respectively. Deliberately last among "core" features since both UIs already exist and only need data.
8. **Admin & settings** — `UsersTable`, `ClassroomsTable`, `ReportsPanel`, `/profile`, `/settings`. Lowest usage frequency, safe to build last.

Each phase should only add the primitives it strictly needs (e.g. `Dialog`/`Form` in Phase 2, `Table` in Phase 5) rather than front-loading the whole design system — keeps unused abstractions out of the codebase, consistent with how the shell itself was built.

## 9. Open questions for the team

- **Real-time updates** — does the Stream/Classwork feed need live updates (websocket/SSE), or is refetch-on-navigation/polling acceptable for v1?
- **File uploads** — `File`/`FileAttachment` models exist; storage backend (S3-compatible? local?) and upload UI (drag-drop vs. picker) aren't decided yet — affects `AnnouncementComposer`, `MaterialCard`, and `SubmissionPanel`.
- **Rich text** — are announcement/assignment bodies plain text, markdown, or a rich-text editor? Affects `AnnouncementComposer` and `AssignmentInstructions` scope significantly.
- **Calendar view** — `/calendar` is listed as a route but its scope (list of due dates vs. full month/week grid) isn't defined yet.
