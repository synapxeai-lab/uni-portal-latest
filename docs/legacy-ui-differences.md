# UI differences: old University Portal vs unified portal

How the unified portal looks and behaves differently from the old `University-portal`, to be addressed later. The functional gaps are in [legacy-feature-gaps.md](legacy-feature-gaps.md).

## Source

Compared from the old portal's own UI spec (`University-portal/docs/ui-theme-guide.md`, `design-system.md`) against the unified client code, 2026-11-14.

## Already the same in both

- EITHM brand colours (navy, gold), Rubik body text and Nunito headings.
- Navy sidebar, 300 px wide, collapsing to an 88 px rail with the crest.
- White logo plate with a gold underline, and an 80 px white header (60 px on mobile).
- Mobile drawer.
- Tables with a grey uppercase header, a gold rule under it and a gold-tint row hover.
- Gold primary button, skeleton shimmer, the "Couldn't load this data" error card.
- Toasts: bottom-right, 3.5 s, success/error colours.
- Lucide icons.

## Differences

| Area | Old University Portal | Unified Portal |
|---|---|---|
| Theme | Light only ("no dark mode") | Light **and dark mode**, with a toggle in the header |
| Header contents | Page title · name/email · avatar · Sign out | Same, plus a **global search bar**, theme toggle, **notifications bell**, and an **ADMINISTRATOR** role badge (admin area) |
| Sidebar groups | ACADEMICS · PEOPLE · ASSESSMENT · FINANCE · ADMINISTRATION | Overview · Schedule · Learning · Academics · University · Admin · Account (adds Calendar, Timetable, Notifications, Classes, To-do/To review) |
| Sidebar icons | Programmes `Layers`, Teachers `GraduationCap`, Students `UserRound`, Attendance `ClipboardCheck`, Marks `Award`, Fees `Wallet` | Different picks: Programmes `GraduationCap`, Teachers `Presentation`, Students `Backpack`, Attendance `CalendarCheck`, Marks `BookCheck`, Fees `Receipt` |
| Detail-page navigation | Muted **"← back" link** with a gold-tint hover pill | **Back button** + **breadcrumbs** (Home › Section › Page) on every page |
| Home / welcome | Large welcome banner (2 rem title) + big stat cards (min 136 px, 48 px icon tile, auto-fit 320 px) | Welcome card + **compact** stat cards; classroom widgets (missing work, upcoming deadlines, pending reviews) |
| Profile on home | "My Profile" field grid (uppercase labels) for teacher and student | None (see feature gap 9 in legacy-feature-gaps.md) |
| Programmes list | Full-width **list rows** with a 42 px icon tile, name, code, description, meta and a chevron | **Cards** |
| Diploma detail | **Detail header with a 4 px coloured left border** and an initials tile; nav-card grid (Sections / Courses) | Summary card in a stat grid + tables on one page |
| Programme's diplomas, courses, offerings | Compact course cards/rows with a code badge and status pill | **Tables** |
| Student detail | Bordered `<dl>` sections (Personal, Contact, Academic, Previous education, Guardian) with navy uppercase headings | One label/value card with fewer fields + courses table |
| Filters | **Filter pills** with count chips ("Status: All 12 · Paid 5 …") | **Select dropdowns** + search inputs (pills only in Calendar and Notifications) |
| Cards/List toggle | Segmented **Cards / List** tabs on many pages, remembered per page | Not present; one fixed layout (a Students / By assessment switch exists only on Marks) |
| Row actions | Text buttons: **Edit** (gold tint) and **Delete** (red tint) | Mostly **icon-only** buttons (pencil / bin); tinted Edit/Delete only on Batches |
| Modals | Custom overlay (52 % black, 3 px blur), **top-aligned and scrolls the overlay**, radius 16, Cancel → Confirm | Radix dialog, **centred**, radius 16, blur, scrolls inside the box; also **side sheets** (e.g. user details) |
| Users list | Index column (#), initials avatar in role colours, current user's row tinted gold | Users table with row-action menu and a details sheet |
| Teacher-pay / challan reports | Download buttons on the page | No download buttons (see feature gap 1 in legacy-feature-gaps.md) |
| Login | Logo **above** a centred 420 px card with a gold top border | Card with a gold top border (kept), logo layout differs; no caps-lock hint |
| Password fields | Caps-lock indicator | None (see feature gap 5 in legacy-feature-gaps.md) |
| API down | Full-screen maintenance overlay | Per-page error cards only (see feature gap 6 in legacy-feature-gaps.md) |
| CTA text | White on gold (about 2.6:1, fails WCAG AA; noted in the old spec) | White on gold in light mode; near-black on gold in dark mode |
| Marks & attendance | Drill-down pages: course → section → category → assessment | Sidebar pages with a **course-section picker**, per-student marksheet, daily attendance sheet |

## In short

The unified portal kept the old brand and shell almost exactly, and added dark mode, global search, notifications and breadcrumbs. It lost the old app's **richer list styling**: icon-tile rows, coloured detail headers, filter pills with counts, the Cards/List toggle and text Edit/Delete buttons. Most lists became plain tables.
