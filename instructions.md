# EITHM Rebranding and UI Redesign — Existing GCR LMS

You are working on an existing, feature-rich Google Classroom-inspired learning management system currently called GCR. The goal is to rebrand and visually improve it for **EITHM — Elevate Institute of Tourism & Hospitality Management**.

This is an existing Next.js application with real authentication, database-backed functionality, role-based access, classroom management, assignment workflows, and a separate admin console.

Your task is to apply a cohesive EITHM design system to the existing application. Do not rebuild the LMS or replace working functionality.

## Phase 1 — Inspect before modifying

Read the repository's README.md and relevant documentation under docs/, particularly the UI architecture, database architecture, and authentication documentation.

Inspect the actual implementation of:

- `src/app` and its layouts.
- `src/app/globals.css` and existing theme variables, if present.
- `src/components/ui`.
- `src/components/shell`.
- `src/components/admin`.
- `src/components/page`.
- `src/components/states`.
- `src/features/dashboard`.
- Classroom, Stream, Classwork, submissions, calendar, search, and admin feature components.
- Existing logo and image assets under `public`.

Use the real file paths discovered in the repository; the paths above are starting points, not permission to assume a file exists.

Determine which existing shared components control the overall appearance and which pages have local styling that must be updated.

Do not start by editing individual pages independently. First establish how the shared design system and application shells work.

## Phase 2 — Establish the EITHM visual identity

Use this color palette consistently:

- Primary navy: `#0B214D`
- Deep navy: `#071936`
- Secondary navy: `#173968`
- Gold: `#F2A900`
- Gold hover: `#D99200`
- Page background: `#F7F8FC`
- Surface: `#FFFFFF`
- Primary text: `#14213D`
- Secondary text: `#64748B`
- Border: `#E2E8F0`
- Soft gold background: `#FFF7E6`

Centralize these values in the existing Tailwind CSS v4 theme and/or CSS variables, following the project's current conventions. Avoid scattered hardcoded color values and duplicated styling.

Use navy for navigation, headings, structure, and primary text. Use gold for active navigation, selected states, progress indicators, important actions, and small accents.

Use white surfaces and subtle grey borders for the learning workspace.

Do not make every card gold or turn the entire content area navy. Preserve readability and adequate color contrast.

Typography should combine an elegant, academic serif for selected major headings with a modern sans-serif for navigation, body text, forms, tables, and controls. Reuse existing fonts if suitable; otherwise introduce an appropriate font configuration with sensible fallbacks.

The overall identity should feel prestigious, academic, welcoming, and relevant to tourism and hospitality education.

## Phase 3 — Use the real EITHM logo

Locate the existing logo asset before making changes.

Use the official logo in the authenticated application shell and admin shell where appropriate. Preserve its aspect ratio and do not redraw or distort it.

If the logo is missing, do not silently substitute a generic graduation-cap icon or fabricate a new official logo. Report that the asset needs to be provided.

Make sure the logo remains legible in the sidebar and responsive layouts. Use an appropriate compact brand treatment only if a suitable asset or safe presentation already exists.

## Phase 4 — Redesign the shared application shell

The existing application already has a teacher/student shell and a separate administrator shell. Preserve both.

### Teacher/student shell

Improve the existing sidebar, header, breadcrumbs, page spacing, navigation states, user menu, notification menu, and mobile navigation.

The sidebar should use navy as its main structural color, with gold accents for the active route and subtle hover states.

Keep navigation clear and compact. Preserve the existing destinations, permission-dependent links, and responsive behavior.

The header should be clean and restrained, with existing search, notifications, and user controls styled consistently.

### Admin shell

Apply the same EITHM design system to the separate admin shell, but preserve its administrator-specific navigation and information density.

Administrative tables, filters, reports, security pages, and audit logs should remain efficient and readable.

Do not merge the teacher/student shell and admin shell into one shell merely to simplify the redesign.

### Shared visual components

Update existing shared components where appropriate:

- Buttons and icon buttons.
- Cards.
- Inputs, selects, and textareas.
- Badges and status labels.
- Dialogs and confirmation dialogs.
- Dropdown menus.
- Tables and pagination.
- Tabs.
- Tooltips.
- Separators.
- Loading skeletons.
- Empty and error states.
- Toast notifications.

Use the existing Radix-based, shadcn/ui-style components. Do not introduce a competing component framework.

Keep the design consistent without making every component oversized, heavily rounded, or shadow-heavy.

## Phase 5 — Student and teacher dashboards

Do not replace the existing role-specific dashboards with a generic dashboard.

### Student dashboard

Preserve the real active/archived classroom counts, upcoming published assignment deadlines, and archived-class preview.

Improve the visual hierarchy so that students can quickly understand:

- Which classrooms they belong to.
- What assignments are due next.
- Which items need their attention.
- Where to find archived classrooms.

Use realistic, restrained course-card styling. Use actual classroom data and existing navigation.

### Teacher dashboard

Preserve the existing active/archived classroom counts, review-queue summary tiles, scheduled-content breakdown, and upcoming-publications list.

Make outstanding reviews and upcoming publications easy to scan.

Use the existing shared review components and queries rather than duplicating their logic.

### Admin dashboard

Preserve the platform-wide statistics, archived classroom and scheduled-content metrics, and recent platform activity.

Improve data hierarchy, spacing, tables, chart presentation, and navigation to detailed reports.

Do not hardcode metrics or fabricate dashboard data.

## Phase 6 — Classroom, Stream, Classwork, and submissions

Apply consistent styling to the existing classroom workflows.

### Classroom experience

Improve classroom cards, classroom headers, course metadata, member information, tabs, and archive indicators.

Retain the existing Stream, Classwork, and People destinations and all role-dependent behavior.

### Stream

Style announcement cards, pinned announcements, comments, creation/edit dialogs, and management actions.

Make pinned content easy to identify without overwhelming the page with gold backgrounds.

### Classwork

Improve topic sections, material cards, assignment cards, due-date labels, attachment displays, lifecycle status badges, and creation/edit dialogs.

Maintain the existing draft, scheduled, published, and closed lifecycle behavior. Draft and scheduled content must remain inaccessible to students until the appropriate publication state.

### Assignment detail and submissions

Improve assignment instructions, attachments, submission forms, grading interfaces, grades, feedback, and private comment threads.

Preserve actual submission, grading, return-work, and feedback functionality.

Maintain confirmation dialogs and clear success/error feedback for important actions.

## Phase 7 — Calendar, search, notifications, and review queue

Apply the EITHM design system to these existing features without replacing their functionality.

- Calendar: preserve Month, Week, and Day views, URL-driven navigation and filters, event details, and classroom-level authorization.
- Global search: preserve the search dialog, Ctrl/Cmd+K shortcut, recent searches, highlighted matches, and `/search` results page.
- Notifications: preserve real notification data, unread counts, and notification actions.
- Teacher review queue: preserve the actual cross-classroom submission list, filters, sorting, summary tiles, grading, return-work, and commenting workflows.

Ensure these pages use the same theme as the rest of the application.

## Phase 8 — Administrator console

Rebrand all existing admin routes consistently:

- Users.
- Classrooms.
- Moderation.
- Reports and report detail pages.
- Audit logs.
- System settings.
- Security overview.
- Active sessions.
- Locked accounts.
- Failed login attempts.

Use a restrained, professional administrative design. Tables should remain compact, searchable, sortable, and readable.

Preserve role checks, authorization, server-side actions, confirmation flows, and audit logging. Do not weaken security or hide the need for confirmation on destructive operations.

## Phase 9 — Responsive design and accessibility

Ensure the redesigned application works at desktop, laptop, tablet, and mobile widths.

Preserve the existing mobile drawer and responsive navigation. Prevent horizontal overflow and make forms, tables, dialogs, tabs, and assignment workflows usable on small screens.

Maintain semantic HTML, keyboard navigation, visible focus states, appropriate accessible names, and sufficient contrast.

Do not communicate status through color alone.

Use subtle transitions only where they improve usability. Avoid excessive gradients, glassmorphism, decorative animation, and oversized empty spaces.

## Phase 10 — Protect the existing architecture

Mandatory constraints:

- Keep Next.js App Router, React, TypeScript, Tailwind CSS v4, Prisma, and the current component architecture.
- Preserve Server Actions, route handlers, validation, database access, and existing request/response contracts.
- Preserve authentication, session revocation, lockout behavior, role permissions, and forced password changes.
- Preserve authorization-aware filtering in search, calendar, dashboards, and classroom features.
- Preserve all existing routes and navigation.
- Do not edit generated Prisma client files.
- Do not modify database schemas or migrations for a purely visual task.
- Do not replace real data with mock data.
- Do not add fake buttons, placeholder destinations, or nonfunctional controls.
- Do not remove existing features to simplify the UI.
- Avoid unnecessary dependencies and broad refactors.
- Do not expose credentials, secrets, or sensitive account information in the UI or logs.

Prefer modifying shared design tokens and reusable components before making local page-level adjustments.

## Phase 11 — Verify the result

Run the project's available lint, formatting, type-checking, and production-build commands.

Inspect the affected routes and correct any errors introduced by the redesign.

Verify the login and authenticated shells, role-specific dashboards, classroom navigation, assignment submission and grading interfaces, calendar, search, notifications, and admin pages to the extent the local environment permits.

If browser testing is available, inspect actual rendered pages at desktop and mobile widths.

Do not reset the database, delete user data, alter production settings, or claim tests passed if they were not run.

## Completion report

At the end, provide:

1. A concise summary of the visual changes.
2. The shared theme and components updated.
3. The pages and shells rebranded.
4. The logo asset used.
5. The checks and builds actually executed, including failures.
6. Any remaining visual inconsistencies or limitations.

Start by inspecting the repository and identifying the smallest coherent set of shared components and theme files to update. Then implement the redesign directly in the existing codebase.
