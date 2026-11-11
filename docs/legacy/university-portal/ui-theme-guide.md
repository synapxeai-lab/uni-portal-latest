# EITHM Portal — UI Theme & Typography Guide

A complete specification of the visual language used by the EITHM University Portal
(`apps/frontend`). Use it to build another project that looks and behaves like part
of the same product family.

> **Source of truth:** every value below is taken from `apps/frontend/src/index.css`,
> `apps/frontend/index.html` and the shared components in `apps/frontend/src/components/`.
> Brand provenance (where each colour came from on eithm.pk) is documented in
> [`design-system.md`](design-system.md).

---

## Contents

1. [Design principles](#1-design-principles)
2. [Tech stack & setup](#2-tech-stack--setup)
3. [Colour system](#3-colour-system)
4. [Typography](#4-typography)
5. [Spacing, radius, shadow, motion](#5-spacing-radius-shadow-motion)
6. [Layout & app shell](#6-layout--app-shell)
7. [Components](#7-components)
8. [States: loading, empty, error, feedback](#8-states-loading-empty-error-feedback)
9. [Iconography](#9-iconography)
10. [Responsive behaviour](#10-responsive-behaviour)
11. [Accessibility](#11-accessibility)
12. [Copy-paste starter: `:root` tokens + base CSS](#12-copy-paste-starter)
13. [Consistency checklist](#13-consistency-checklist)

---

## 1. Design principles

| Principle | What it means in practice |
|---|---|
| **Navy is primary; gold is the call to action** | Text-bearing actions (links, active tabs, outlines, focus rings) use navy or royal blue. Gold is kept for primary buttons, the active nav indicator, accent rules and selected states. |
| **Quiet, warm surfaces** | Off-white page (`#F9F8F8`), white cards, warm-grey borders (`#E5E3DF`). Shadows are faint and navy-tinted, never black. |
| **Tokens only** | Components reference semantic CSS variables (`--primary`, `--cta-bg`, `--text-mid`…), never raw hex or `--brand-*` values. Change a colour once in `:root` and the whole app follows. |
| **Plain CSS, no framework** | One global stylesheet with BEM-ish class names (`.dept-row`, `.dept-row-name`). There is no Tailwind, CSS-in-JS or UI kit. Inline `style` is used only for one-off layout and data-driven colours (status pills, icon tiles). |
| **Light mode only** | The portal ships no dark theme. If the new project adds one, derive it from the same tokens. |
| **Skeletons, not spinners** | Loading placeholders mirror the final layout so nothing shifts. |
| **Motion is subtle and optional** | 150 ms transitions, an 8 px fade-in, and everything disabled under `prefers-reduced-motion`. |

---

## 2. Tech stack & setup

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Routing | react-router-dom 6 |
| Data | @tanstack/react-query 5 |
| Icons | `react-icons` with the **Lucide** set only (`react-icons/lu`) |
| Styling | A single global `src/index.css` |
| Fonts | Google Fonts: **Rubik** (body) and **Nunito** (headings) |

### `index.html` head

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#171F32" />

<link rel="icon" type="image/png" sizes="32x32"  href="/assets/branding/eithm-favicon-32.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/assets/branding/eithm-favicon-192.png" />
<link rel="apple-touch-icon" href="/assets/branding/eithm-apple-touch-icon.png" />

<!-- Logo is in the first paint of every page -->
<link rel="preload" as="image" href="/assets/branding/eithm-logo-540.png" />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Rubik:wght@400;500;600;700&display=swap" />
```

### Brand assets

Copy `apps/frontend/public/assets/branding/` into the new project as-is.

| File | Size | Use |
|---|---|---|
| `eithm-logo-540.png` | 540×193 | Default logo (sidebar, login). Aspect ratio **540 / 193**. |
| `eithm-logo.png` | 1620×580 | `srcset` fallback for dense screens. |
| `eithm-crest-180.png` / `eithm-crest.png` | square | Shield only: collapsed sidebar, small spaces. |
| `eithm-favicon-32.png`, `-192.png`, `eithm-apple-touch-icon.png` | — | Browser icons. |

The logo has an **opaque white background**, so always place it on a white surface
(the sidebar gives it a white "plate" with a gold underline). Never put it straight on navy.

---

## 3. Colour system

### 3.1 Brand palette (raw, do not use directly in components)

| Token | Hex | Swatch role |
|---|---|---|
| `--brand-navy` | `#171F32` | Sidebar, primary text actions, theme colour |
| `--brand-navy-deep` | `#011B4B` | Primary hover, logo navy |
| `--brand-royal` | `#3F3C8F` | Links, focus ring, info, teacher role |
| `--brand-gold` | `#D9A11E` | CTA buttons, active nav, selected borders |
| `--brand-gold-hover` | `#C08E19` | CTA hover |
| `--brand-gold-light` | `#F2B233` | Table header underline |
| `--brand-gold-tint` | `#FFF8E6` | Soft highlight: row hover, selected background |
| `--brand-gold-soft` | `#FFE9B3` | Soft gold border |

### 3.2 Semantic tokens (use these)

**Actions**

| Token | Value | Use |
|---|---|---|
| `--primary` | navy `#171F32` | Active tab fill, outline-button hover text, focus border on inputs |
| `--primary-hover` | `#011B4B` | Hover on navy elements |
| `--primary-soft` | `#FFF8E6` | Hover/selected background (rows, pills, nav buttons) |
| `--primary-border` | `#FFE9B3` | Border on soft-gold surfaces |
| `--primary-ring` | `rgba(217,161,30,0.35)` | 3 px focus glow on inputs |
| `--cta-bg` / `--cta-bg-hover` | `#D9A11E` / `#C08E19` | `.btn-primary` |
| `--cta-text` | `#FFFFFF` | Text on gold (see the accessibility note in §11) |
| `--link` / `--link-hover` | `#3F3C8F` / `#171F32` | Anchors |
| `--focus` | `#3F3C8F` | `:focus-visible` outline |

**Surfaces & text**

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F9F8F8` | Page background, subtle hover on white |
| `--surface` | `#FFFFFF` | Cards, header, modals, inputs |
| `--surface-muted` | `#F3F2F0` | Table header, read-only fields, muted badges |
| `--border` | `#E5E3DF` | Default 1 px border everywhere |
| `--border-dark` | `#CCCCCC` | Hover border, outline buttons, chevrons |
| `--text` | `#101010` | Headings, primary values |
| `--text-mid` | `#394459` | Body copy, labels, secondary buttons |
| `--text-muted` | `#5F6675` | Meta text, captions, table headers |
| `--text-faint` | `#8A909C` | Footnotes, decorative icons |

**Navigation (navy sidebar)**

| Token | Value |
|---|---|
| `--nav-bg` | `#171F32` |
| `--nav-text` | `#FFFFFF` (hover) |
| `--nav-text-muted` | `#E0E0E0` (default item text) |
| `--nav-hover` | `rgba(255,255,255,0.06)` |
| `--nav-active` | `rgba(217,161,30,0.14)` |
| `--nav-accent` | `#D9A11E` |
| `--nav-border` | `rgba(255,255,255,0.10)` |
| Section label | `rgba(224,224,224,0.45)` |

**Status (semantic, not brand)**

| Intent | Text | Background | Border |
|---|---|---|---|
| Success | `#15803d` | `#f0fdf4` | `#86efac` |
| Warning | `#92400e` | `#fef3c7` | `#fde68a` |
| Error | `#be123c` (hover `#9f1239`) | `#fff1f2` | `#fecdd3` |
| Info | `#3F3C8F` | `#EEEDF8` | — |

**Roles**

| Role | Text | Background | Border | Avatar bg |
|---|---|---|---|---|
| Admin | `#171F32` | `#EEF0F5` | `#C9CEDA` | `#DDE1EA` |
| Teacher | `#3F3C8F` | `#EEEDF8` | `#CFCDEB` | `#DFDDF3` |
| Student | `#15803d` | `#f0fdf4` | `#bbf7d0` | `#dcfce7` |

### 3.3 Data-driven status pills (used inline in components)

These triples (`color` / `bg` / `border`) are applied as inline styles on `.status-pill`:

| Meaning | color | bg | border |
|---|---|---|---|
| Paid / Open / Live / Assigned | `#166534` | `#dcfce7` | `#bbf7d0` |
| Awaiting approval | `#a16207` | `#fefce8` | `#fde68a` |
| Unpaid / failure | `#b91c1c` | `#fef2f2` | `#fecaca` |
| Upcoming | `var(--primary)` | `var(--primary-soft)` | `var(--primary-border)` |
| Not graded / inactive | `var(--text-muted)` | `var(--surface-muted)` | `var(--border)` |

**Category accents** (programme categories): Culinary `#b45309` on `#fef3c7`; CPD `#1565c0` on `#e8f1fd`.

### 3.4 Stat tile colour pairs

Icon tiles on dashboards use a token pair (`color` on `bg`):

| Metric type | color | bg |
|---|---|---|
| Users / admin | `--brand-navy` | `--admin-bg` |
| Teachers, diplomas | `--brand-royal` | `--teacher-bg` |
| Students | `--success` | `--success-bg` |
| Programmes | `--brand-gold-hover` | `--primary-soft` |
| Courses | `--error` | `--error-bg` |

---

## 4. Typography

### 4.1 Families

| Token | Stack | Applied to |
|---|---|---|
| `--font-body` | `"Rubik", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `body`, `input`, `select`, `textarea`, `button` |
| `--font-heading` | `"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `h1–h6`, `.dash-page-title`, table `<th>` |
| Monospace | `ui-monospace, SFMono-Regular, Consolas, monospace` + `letter-spacing: 0.04em` | Credentials, passwords, codes |

**Weights loaded:** Rubik 400 / 500 / 600 / 700; Nunito 600 / 700 / 800.

### 4.2 Base

```css
html { font-size: 18px; }                 /* desktop */
@media (max-width: 768px) { html { font-size: 16px; } }  /* phones/tablets */

body { font-family: var(--font-body); line-height: 1.6; color: var(--text);
       -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
h1,h2,h3,h4,h5,h6 { font-family: var(--font-heading); font-weight: 700; line-height: 1.3; }
```

Because the root is **18 px**, `rem` values render larger than usual. Most sizes are
in `rem`, so they scale down automatically on mobile (16 px root). Header and sidebar
chrome use fixed `px`.

### 4.3 Type scale

| Role | Class | Size | Desktop px | Weight | Other |
|---|---|---|---|---|---|
| Welcome heading | `.welcome-title` | `2rem` | 36 | 700 | Nunito; 1.05rem on ≤600 px |
| Stat value | `.stat-value` | `30px` | 30 | 700 | line-height 1; 24px on ≤480 px |
| Header page title | `.dash-page-title` | `24px` | 24 | 700 | Nunito; 18px on ≤768 px |
| Page title | `.page-title` | `1.25rem` | 22.5 | **800** | Nunito |
| Login heading | inline | `1.15rem` | 20.7 | 800 | |
| Modal title | `.modal-title` | `1.05rem` | 18.9 | 800 | |
| Sidebar item | `.sidebar-nav-item` | `18px` | 18 | 500 (active 600) | |
| Header user name | `.dash-header-name` | `16px` | 16 | 600 | |
| Transcript stat | `.transcript-stat-value` | `1.1rem` | 19.8 | 700 | colour `--primary` |
| Nav card label | `.dept-nav-label` | `0.95rem` | 17.1 | 700 | |
| Primary button | `.btn-primary` | `0.95rem` | 17.1 | 700 | `letter-spacing: 0.01em` |
| Form input | `.form-input` | `0.94rem` | 16.9 | 400 | 16px on mobile (no iOS zoom) |
| List row title | `.dept-row-name` | `0.92rem` | 16.6 | 700 | |
| Body / welcome sub | `.welcome-sub` | `0.9rem` | 16.2 | 400 | `--text-mid` |
| Card item name | `.course-name` | `0.87rem` | 15.7 | 600 | |
| Table body, buttons, alerts | `.users-table`, `.btn-outline` | `0.875rem` | 15.75 | 400 / 600 | |
| Group heading | `.semester-heading` | `0.85rem` | 15.3 | 700 | Nunito |
| Back link | `.back-link` | `0.83rem` | 14.9 | 600 | |
| Form label, page subtitle | `.form-label`, `.page-subtitle` | `0.8rem` | 14.4 | 600 / 400 | |
| Row description / meta | `.dept-row-desc` | `0.8rem` | 14.4 | 400 | |
| Small action button | `.btn-edit`, `.btn-del` | `0.78rem` | 14 | 600 | |
| Table header | `.users-table th` | `0.75rem` | 13.5 | 700 | **UPPERCASE**, `0.04em`, Nunito, `--text-muted` |
| Stat label | `.stat-label` | `13px` | 13 | 600 | **UPPERCASE**, `0.02em` |
| Field label (profile) | `.profile-field-label` | `0.72rem` | 13 | 700 | **UPPERCASE**, `0.03em` |
| Pill / role pill | `.role-pill`, `.filter-pills-label` | `0.72rem` | 13 | 700 | uppercase for labels, `0.03–0.08em` |
| Status pill, badge | `.status-pill`, `.role-badge` | `0.68rem` | 12.2 | 700 | `0.03–0.06em` |
| Sidebar section label | `.sidebar-nav-section` | `11px` | 11 | 700 | **UPPERCASE**, `0.08em` |

### 4.4 Typographic rules

- **Headings** use Nunito with weight 700 (sections) or 800 (page and modal titles).
- **Overlines** (table headers, stat labels, field labels, section names) are small,
  bold, **uppercase**, tracked `0.02–0.08em` and coloured `--text-muted`, or
  `--primary` in detail sections.
- **Values beat labels**: a label is muted and small; the value under it is `--text` and semi-bold (600).
- Body copy is `--text-mid`. Use `--text` only for headings, names and values.
- Long single-line text truncates with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- Emails and IDs that may overflow use `overflow-wrap: anywhere`.
- Dates are formatted `en-GB` (`20 Oct 2026`) and currency as `Rs. 12,500`.

---

## 5. Spacing, radius, shadow, motion

### 5.1 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | Inputs, buttons, small cards, badges |
| (fixed) | `8px` | Sidebar items, stat cards, header buttons |
| `--radius` | `10px` | Cards, tables, banners, tab group |
| `--radius-lg` | `16px` | Modals, login card |
| `--radius-xl` | `24px` | Reserved |
| Pills | `20px` / `999px` | Status, role and filter pills |

### 5.2 Shadows (navy-tinted, `rgba(23,31,50,…)`)

| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(23,31,50,.05)` | Resting cards and rows |
| `--shadow-sm` | `0 2px 6px rgba(23,31,50,.07)` | Card hover |
| `--shadow` | `0 6px 18px rgba(23,31,50,.09)` | Dropdowns |
| `--shadow-lg` | `0 8px 40px rgba(23,31,50,.16)` | Login card |
| Modal | `0 20px 48px rgba(23,31,50,.18)` | `.modal-box` |

### 5.3 Spacing rhythm

There is no formal spacing scale. These values recur:

| Context | Value |
|---|---|
| Main content padding | `40px 52px` desktop, `1rem` ≤768 px, `0.75rem` ≤480 px |
| Gap between page sections | `32px` (banner, stat grid) / `1.5rem` (groups) |
| Grid gaps | `16px` / `1rem` |
| List gaps (stacked rows) | `0.6–0.65rem` |
| Card padding | `24px` stat card, `1.1–1.35rem` info cards, `1rem 1.25rem` list rows |
| Modal padding | `1.75rem` (`1.25rem` mobile) |
| Form group spacing | `margin-bottom: 1.1rem`; label to input `0.35rem` |
| Icon to text gap | `0.3–0.45rem` small, `0.9–1rem` in rows |

### 5.4 Motion

```css
--transition: 150ms ease;
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fade-in { animation: fadeIn .25s ease forwards; }   /* every page body */
```

- Hover lifts: clickable stat cards `translateY(-2px)`; role cards `-1px`; nav-button arrows `translateX(3px)`.
- Modals fade in over `0.18s`; toasts over `0.2s`.
- Sidebar: `transform .25s ease` (mobile drawer) and `width .2s ease` (collapse).
- **Reduced motion:** every animation and transition is set to `0.01ms`, and skeleton shimmer is removed.

---

## 6. Layout & app shell

```
┌──────────────┬──────────────────────────────────────────────────┐
│  WHITE LOGO  │  Page Title                Name / email  (AB) │ ⎋ │  ← 80px white header, 1px bottom border
│  PLATE  ‹    │──────────────────────────────────────────────────│
│══gold 3px════│                                                  │
│ ▌Dashboard   │   #F9F8F8 page, padding 40px 52px                │
│  ACADEMICS   │   ┌ welcome banner ────────────────────────────┐ │
│  Programmes  │   └────────────────────────────────────────────┘ │
│  Batches     │   ┌ stat ┐ ┌ stat ┐ ┌ stat ┐   (auto-fit 320px) │
│  …           │   └──────┘ └──────┘ └──────┘                     │
│  navy 300px  │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### Sidebar (`.sidebar`)

- Width **300px**, collapsed **88px** (desktop only, state saved in `localStorage.sidebarCollapsed`).
- Sticky, full height (`100dvh`), background `--nav-bg`. The scrollbar is hidden until hover.
- **Logo plate:** white, `min-height: 80px` (matches the header), `border-bottom: 3px solid var(--brand-gold)`,
  logo `height: 58px`. When collapsed, it switches to the 52 px crest.
- **Collapse button:** 34×34, white with a 1 px border, radius 8; hover changes it to a gold-tint background with a gold border.
- **Nav:** `padding: 18px 12px 24px`, `gap: 4px`.
- **Item:** `min-height: 48px`, `padding: 0 16px`, `gap: 14px`, radius 8, 18 px / 500, colour `#E0E0E0`, Lucide icon 18 px in a 22 px slot.
  - Hover: `rgba(255,255,255,.06)` background, white text.
  - **Active:** `rgba(217,161,30,.14)` background, **gold text**, weight 600, and a **3 px gold bar** on the left edge (`top/bottom: 10px`, radius `0 3px 3px 0`).
  - Disabled: 45 % opacity text with a "Soon" badge.
- **Section labels** (ACADEMICS, PEOPLE, ASSESSMENT, FINANCE, ADMINISTRATION): 11 px, 700, uppercase, `0.08em`, 45 % white. When collapsed, each becomes a 1 px divider line.
- **Mobile (≤768 px):** a fixed drawer (`max-width: 85vw`) slides in from the left over a `rgba(0,0,0,.45)` overlay with a 1 px blur. Body scroll locks while it is open.

### Top header (`.dash-header`)

- Height **80px** (60 px mobile), white, `border-bottom: 1px solid var(--border)`, sticky, `padding: 0 24px 0 40px`.
- Left: hamburger (mobile only) and the page title (Nunito 24 / 700).
- Right: name (16 / 600) and email (14, muted) stacked right-aligned; a 42 px circular **avatar**
  with initials (gold-tint background, navy text, soft-gold border); a 1 px × 26 px divider; and a
  **Sign out** button (42 px tall, 1 px border, radius 8, 15 px / 600).
- On ≤480 px the name/email, the divider and the "Sign out" label are hidden.

### Main area (`.dash-main`)

- Background `--bg`, padding `40px 52px`. Content is wrapped in `.fade-in`.

### Page anatomy

1. `.back-link` (on detail pages): a muted 0.83 rem/600 link with a chevron that shows a gold-tint hover pill.
2. `.page-header`: title (1.25 rem/800) and subtitle (0.8 rem muted) on the left, primary action on the right.
3. Filters: `.filters-bar` (search and selects) and/or `.filter-pills-row`.
4. Optional `.view-tabs` Cards/List toggle.
5. Content: card grid, list rows or `.table-card`.

---

## 7. Components

Each spec gives the visual rules, followed by the reference CSS where it helps.

### 7.1 Buttons

| Variant | Class | Look | Hover |
|---|---|---|---|
| **Primary CTA** | `.btn-primary` | Gold bg, white text, 700, `0.72rem 1rem`, radius 6. Full width by default; `width:auto` inside headers, modals and toolbars. | `#C08E19` |
| **Secondary** | `.btn-outline` | White bg, `1px #CCC` border, `--text-mid`, 600, `0.6rem 1.25rem` | Gold-tint bg, gold border, navy text |
| **Danger** | `.btn-danger` | `#be123c` bg, white, 700 | `#9f1239` |
| **Row edit** | `.btn-edit` | Gold-tint bg, soft-gold border, navy text, `0.3rem 0.65rem`, 0.78 rem | Solid navy, white text |
| **Row delete** | `.btn-del` | Error-bg, error border, error text | Solid red, white text |
| **Icon** | `.icon-btn` | 28×28, white, 1 px border, radius 6 | Gold-tint bg, navy icon |
| **Icon danger** | `.btn-icon-danger` | 26×26, red icon | Error-bg |
| **Text nav** | `.nav-btn` | Inline, 600, no underline, `--text` | Gold-tint pill, arrow nudges 3 px |

Disabled: primary becomes `--border` bg with muted text; others drop to 40–60 % opacity with `cursor: not-allowed`.
Icons inside buttons: `.btn-with-icon` (`inline-flex; gap: .45rem`), icon 15–17 px.

```css
.btn-primary { padding:.72rem 1rem; background:var(--cta-bg); color:var(--cta-text); border:none;
  border-radius:var(--radius-sm); font-weight:700; font-size:.95rem; letter-spacing:.01em; cursor:pointer;
  transition: background var(--transition); }
.btn-primary:hover:not(:disabled) { background:var(--cta-bg-hover); }
.btn-outline { padding:.6rem 1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border-dark);
  background:var(--surface); color:var(--text-mid); font-size:.875rem; font-weight:600; }
.btn-outline:hover { background:var(--primary-soft); border-color:var(--brand-gold); color:var(--primary); }
```

### 7.2 Form controls

- **Label** `.form-label`: 0.8 rem / 600, `--text-mid`, `0.01em`, 0.35 rem below.
- **Input** `.form-input`: `0.65rem 0.9rem`, **1.5 px** `--border`, radius 6, white, 0.94 rem.
  - Focus: navy border plus a `0 0 0 3px var(--primary-ring)` gold glow (no outline).
  - Error: `.has-error` gives a red border and a red 12 % glow; message in `.field-error` (0.74 rem red).
  - Hint `.field-hint`: 0.72 rem muted.
- **Input with action** (password eye): `.form-input-wrap` with a right-aligned `.form-input-action` icon button.
- **Search** `.search-input`: 38 px tall, 1 px border, icon left and clear button right (`padding: 0 2.25rem`).
- **Select** `.filter-select`: 38 px, `min-width: 130px`, same focus glow.
- **Two-column form** `.form-row`: a `1fr 1fr` grid with a `1rem` column gap that collapses to one column at ≤560 px.
- **Choice cards** `.role-card`: grid of 3, muted background with a 1.5 px border. Selected: gold border on a gold-tint background, label in navy uppercase 0.72 rem.
- Read-only control: `--surface-muted` background.
- On mobile, all inputs are **16px** so iOS doesn't zoom.

### 7.3 Cards & rows

| Component | Spec |
|---|---|
| **Welcome banner** `.welcome-banner` | White, 1 px border, radius 10, `32px 28px`, 32 px bottom margin. Title 2 rem / 700; sub 0.9 rem `--text-mid`, `max-width: 620px`. |
| **Stat card** `.stat-card` | White, 1 px border, radius 8, padding 24, `min-height: 136px`, flex row with an 18 px gap. A **48×48 icon tile** (radius 10, coloured pair from §3.4, 22 px icon), then the label (13 px uppercase) and value (30 px / 700). `.clickable` hover: darker border, `0 6px 18px` shadow, lift 2 px. Grid: `repeat(auto-fit, minmax(320px, 1fr))`, gap 16. |
| **Info card** `.info-card` | White, border, radius 10, padding 1.35 rem, `--shadow-xs`. Title 0.875 rem / 700 with an icon. |
| **Profile fields** `.profile-field-grid` | `auto-fill minmax(200px,1fr)`; label uppercase 0.72 rem muted; value 0.88 rem / 600. |
| **List row** `.dept-row` | Full-width button: white, border, radius 10, `1rem 1.25rem`, gap 1 rem. A 42 px icon tile, a body (name 0.92 rem/700 + code 0.7 rem muted tracked + one-line description 0.8 rem), right-aligned meta (0.74 rem muted, with icons) and a chevron in `--border-dark`. Hover: `--shadow-sm` and a darker border. |
| **Compact card** `.course-card` / `.course-row` | Radius 6, `0.85rem 1rem`. Code badge (0.72 rem / 700, radius 6, tinted) + name (0.87 rem / 600) + credits + status pill + actions. |
| **Nav card grid** `.dept-nav-card` | `auto-fill minmax(260px,1fr)`; 42 px icon tile, label 0.95 rem / 700, detail 0.78 rem muted. |
| **Detail header** `.dept-detail-header` | White card with a **4 px coloured left border**, a 52 px icon tile with initials (800 weight), and a meta row of icon + text items. |
| **Detail section** `.details-section` | 1 px border, radius 10. Heading 0.7 rem uppercase **navy** `0.05em`. Two-column `<dl>`: `dt` 0.72 rem muted, `dd` 0.86 rem / 500. |
| **Summary strip** `.transcript-summary` | White card; stat chips on a gold-tint background with a soft-gold border, label 0.7 rem uppercase, value 1.1 rem / 700 navy. |
| **Placeholder** `.placeholder-card` | 2 px **dashed** border, radius 10, `3rem 2rem`, centred. |

### 7.4 Tables

```
┌───────────────────────────────────────────────┐  .table-card: white, border, radius 10, overflow hidden
│ #   NAME            EMAIL         ROLE   ⋯    │  th: #F3F2F0, Nunito 0.75rem/700 UPPERCASE, muted
│═══════════════════════════════════════════════│  ← 2px solid #F2B233 (gold-light) rule
│ 1  (AB) Ali Bhatti  ali@…         ADMIN  ✎ 🗑 │  td: 0.95rem 1rem padding, 1px #E5E3DF rows
│ 2  …                                          │  hover row: #FFF8E6
└───────────────────────────────────────────────┘
```

- Wrap in `.table-scroll` (`overflow-x: auto`) so wide tables scroll sideways instead of breaking the layout.
- Cells: `0.875rem`, `vertical-align: middle`; the last row has no bottom border.
- Index column `.td-idx` (muted, 40 px); email `.td-email` (mid, truncate at 220 px); dates `.td-date` (muted 0.8 rem, nowrap).
- User cell: a 32 px circular avatar with initials in role colours, then the name in 600.
- Actions right-aligned in `.td-actions` (`gap: .4rem`).
- Clickable rows `.row-clickable` (pointer, gold-tint hover). The current user's row is tinted gold.
- Totals row: bold on a `--bg` background with a top border.
- Sticky-header variant (inside a scroll box): the header is gold-tint with navy-deep text.
- Mobile: cell padding drops to `0.6rem 0.75rem`; low-value columns may be hidden at ≤640 and ≤420 px.

### 7.5 Pills, badges & tags

| Element | Spec |
|---|---|
| `.status-pill` | `0.2rem 0.6rem`, radius 20, 0.68 rem / 700, 1 px border, `0.03em`; colours inline from §3.3 |
| `.role-pill` | `0.22rem 0.65rem`, radius 20, 0.72 rem / 700, 1 px border |
| `.role-badge` | radius 20, 0.68 rem / 700, uppercase `0.06em` |
| `.dept-badge-pill` | `0.12rem 0.5rem`, radius 12, 0.68 rem / 700, tinted |
| `.course-code-badge` | `0.3rem 0.55rem`, radius 6, 0.72 rem / 700, `0.03em` |
| `.badge-you` | radius 4, muted surface and border, 0.67 rem / 600 |
| `.section-picker-badge` | 26 px tall, radius 6, **solid navy, white text** (muted grey when static) |

### 7.6 Filters, tabs, toggles

- **Filter pills** `.filter-pills`: a label (0.72 rem / 700 uppercase `0.08em`, `--text-mid`, followed by ":"), then pills:
  `0.35rem 0.95rem`, radius 999, 1 px border, 0.8 rem / 500. **Active:** gold-tint background, **gold border**, navy text, 600.
  An optional count chip sits inside each pill (0.7 rem, muted pill, which turns white with navy text when active).
  Several groups sit on one `.filter-pills-row` (`column-gap: 2rem`).
- **View tabs / segmented control** `.view-tabs`: a white container with a 1 px border, radius 10, 4 px padding and a 4 px gap.
  Tab: `0.5rem 1rem`, radius 7, 0.85 rem / 600, muted. **Active: solid navy with white text.** Hover: `--bg`.
  Used for the Cards/List toggle (`LuLayoutGrid` / `LuList`, 15 px), which is remembered in `localStorage`.

### 7.7 Modals & dialogs

- Overlay `.modal-overlay`: fixed, `z-index: 9000`, `rgba(0,0,0,.52)` with a **3 px blur**. The **overlay scrolls**, not the box.
  It is top-aligned with `padding: 3rem 1rem` so the top of a tall modal is never clipped.
- Box `.modal-box`: white, radius 16, padding 1.75 rem, `max-width: 500px` (`.modal-box-lg` 600 px; confirm dialog 400 px), fades in over 0.18 s.
- Header: title (1.05 rem / 800) and a **close button** (30×30, `--bg`, 1 px border, radius 6) that turns red-tinted on hover.
- Footer `.modal-actions`: right-aligned with a 0.75 rem gap and 1.5 rem top margin, order **Cancel (outline) → Confirm (primary/danger)**.
  On ≤480 px both buttons stretch to equal width.
- **Confirm dialog:** title 1 rem / 700, message 0.875 rem `--text-mid`, default confirm label "Delete" with `.btn-danger`.
- Render through a React portal into `document.body`. Clicking the backdrop cancels.

### 7.8 Dropdown / autocomplete

`.teacher-suggest-list`: white, 1 px border, radius 6, `--shadow`, `max-height: 220px`, 0.3 rem padding.
Items: `0.5rem 0.65rem`, radius 6, hover `--bg`; primary line 0.85 rem / 600, secondary 0.72 rem muted.

### 7.9 Login page

- Full-height `--bg` page with the card centred, `max-width: 420px`.
- Logo above the card (76 px tall, 60 px on mobile) with a 0.78 rem muted tagline.
- Card `.auth-form-box`: white, radius 16, `2.25rem 2rem`, `--shadow-lg`, 1 px border and a **4 px gold top border**.
- Heading 1.15 rem / 800 and a sub line 0.82 rem muted, then the fields and a full-width gold button.

### 7.10 Credentials box

A muted surface with a 1 px border and radius 6, divided into rows (`0.6rem 0.75rem`). Each row has a 70 px muted label,
a 0.88 rem / 600 value (monospace for passwords) and a copy `.icon-btn`.

---

## 8. States: loading, empty, error, feedback

| State | Pattern |
|---|---|
| **Loading** | `<SkeletonRegion>` wraps skeleton blocks built from the **same layout classes** as the real content. Blocks: `--skeleton-base #ECEAE6` with a `#F7F6F3` shimmer sweep (1.6 s ease-in-out). The region fades in after **120 ms**, so fast loads never flash. It exposes one `role="status"` "Loading…" message to screen readers. On navy, skeletons use 8 % white. Stat cards render immediately and only the number is a skeleton. |
| **Empty** | `.table-empty`: centred column, `3.5rem 1rem`, a muted icon above 0.875 rem muted text. Or a dashed `.placeholder-card`. |
| **Error (page data)** | `.error-state`: a white card with an error border and a **4 px red left border**, a 24 px warning icon, the title "Couldn't load this data" (600), the message in 0.82 rem mid, and a "Try again" outline button whose icon spins while retrying. `role="alert"`. |
| **Inline alert** | `.alert-error` / `.alert-success`: tinted background with a matching border, radius 6, 0.875 rem, icon on the left. |
| **Toast** | Bottom-right (full-width bottom bar on mobile), `max-width: 340px`, radius 10, `0.75rem 1.1rem`, 0.87 rem / 600, `0 4px 16px rgba(0,0,0,.12)`. Success: `#166534` on `#f0fdf4` with a `#bbf7d0` border and `LuCircleCheck`. Error: `#b91c1c` on `#fef2f2` with a `#fecaca` border and `LuTriangleAlert`. Auto-dismisses after **3.5 s**, has an × close button and renders in a portal. |
| **Busy button** | Label changes ("Retrying…", "Saving…"), the button is disabled and `.spin` animates the icon. |

---

## 9. Iconography

- **Library:** Lucide via `react-icons/lu` only. Don't mix icon sets.
- **Sizes:** 18 px in nav and header; 22 px in stat tiles; 24 px in error states; 15–17 px in buttons, toasts and tabs; 14 px inline with meta text (coloured `--text-faint`).
- **Icon tiles:** a square of 42–52 px with radius 6–10 and a tinted `bg` with a matching `color` (see §3.4).
- **Common mapping** (keep it consistent across projects):

| Concept | Icon |
|---|---|
| Dashboard / home | `LuLayoutGrid` |
| Programmes / departments | `LuLayers` |
| Batches | `LuCalendarRange` |
| Courses | `LuBookMarked` · My courses `LuBookOpen` · Offer `LuBookPlus` |
| Registration | `LuCalendarClock` |
| Teachers / students | `LuGraduationCap` · `LuUserRound` · Assign `LuUserCheck` |
| Users | `LuUsers` |
| Attendance | `LuClipboardCheck` / `LuClipboardList` |
| Marks · Criteria · Grades | `LuAward` · `LuPercent` · `LuMedal` |
| Fee / finance | `LuWallet` |
| Transcript / diplomas | `LuScrollText` |
| Menu · Sign out · Collapse | `LuMenu` · `LuLogOut` · `LuChevronLeft/Right` |
| Success · Warning · Close · Retry | `LuCircleCheck` · `LuTriangleAlert` · `LuX` · `LuRotateCw` |

---

## 10. Responsive behaviour

| Breakpoint | Changes |
|---|---|
| **≤768 px** | Root font 16 px. Sidebar becomes an off-canvas drawer with a hamburger. Header 60 px, title 18 px, avatar 36 px. Main padding 1 rem. Logo plate 60 px with a 44 px logo. Inputs 16 px. Search takes a full row and selects share the next. Tabs scroll horizontally. Table cells tighten. Toast spans the bottom. |
| **≤720 px** | Card/row items wrap: title takes the full width, then pill, credits and actions. |
| **≤640 px** | List rows wrap with meta under the title and no chevron. Low-value table columns may be hidden. Modals pad 1.25 rem. |
| **≤600 px** | Stat grid becomes 2 columns. Welcome banner shrinks. |
| **≤560 px** | Two-column forms stack. |
| **≤480 px** | Stat cards stack the icon above the text and the value drops to 24 px. Header hides the name and email. Modal action buttons stretch. Detail header stacks. Row action buttons show icons only. |
| **≤380 px** | Stat grid becomes 1 column. |
| **≥769 px** | Sidebar collapse to 88 px is available. |

Use `100dvh` (with a `100vh` fallback) for full-height elements on mobile.

---

## 11. Accessibility

- **Focus:** global `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }` (royal blue). Inside the navy sidebar the outline is **gold**. Inputs use the gold 3 px ring plus a navy border instead.
- **Contrast caveat:** white on gold `#D9A11E` is about **2.6:1**, which fails WCAG AA. It matches eithm.pk's buttons. If the new project must meet AA, set `--cta-text: var(--brand-navy)` (about 6.3:1); nothing else needs to change.
- **Reduced motion** is respected globally (see §5.4).
- Use `aria-label` on icon-only buttons, `role="tablist"`/`aria-selected` on view tabs, `aria-pressed` on filter pills, and `role="alert"` on error states. Use `.sr-only` for visually hidden text.
- Clickable rows and cards are real `<button>` elements (with `font-family: inherit; text-align: left; width: 100%`), not clickable `<div>`s.
- Touch targets are at least 36–48 px in the shell (nav item 48 px, header buttons 42 px).

---

## 12. Copy-paste starter

Drop this into the new project's global stylesheet to inherit the theme. Then port
component classes from `apps/frontend/src/index.css` as needed.

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Brand */
  --brand-navy:#171F32; --brand-navy-deep:#011B4B; --brand-royal:#3F3C8F;
  --brand-gold:#D9A11E; --brand-gold-hover:#C08E19; --brand-gold-light:#F2B233;
  --brand-gold-tint:#FFF8E6; --brand-gold-soft:#FFE9B3;

  /* Navigation */
  --nav-bg:var(--brand-navy); --nav-hover:rgba(255,255,255,.06); --nav-active:rgba(217,161,30,.14);
  --nav-text:#FFFFFF; --nav-text-muted:#E0E0E0; --nav-accent:var(--brand-gold); --nav-border:rgba(255,255,255,.10);

  /* Actions */
  --primary:var(--brand-navy); --primary-hover:var(--brand-navy-deep);
  --primary-soft:var(--brand-gold-tint); --primary-border:var(--brand-gold-soft); --primary-ring:rgba(217,161,30,.35);
  --cta-bg:var(--brand-gold); --cta-bg-hover:var(--brand-gold-hover); --cta-text:#FFFFFF;
  --link:var(--brand-royal); --link-hover:var(--brand-navy); --focus:var(--brand-royal);

  /* Surfaces & text */
  --bg:#F9F8F8; --surface:#FFFFFF; --surface-muted:#F3F2F0;
  --border:#E5E3DF; --border-dark:#CCCCCC;
  --text:#101010; --text-mid:#394459; --text-muted:#5F6675; --text-faint:#8A909C;

  /* Status */
  --success:#15803d; --success-bg:#f0fdf4; --success-border:#86efac;
  --warning:#92400e; --warning-bg:#fef3c7; --warning-border:#fde68a;
  --error:#be123c; --error-hover:#9f1239; --error-bg:#fff1f2; --error-border:#fecdd3;
  --info:var(--brand-royal); --info-bg:#EEEDF8;

  /* Roles */
  --admin-color:var(--brand-navy); --admin-bg:#EEF0F5;
  --teacher-color:var(--brand-royal); --teacher-bg:#EEEDF8;
  --student-color:#15803d; --student-bg:#f0fdf4;

  /* Skeletons */
  --skeleton-base:#ECEAE6; --skeleton-highlight:#F7F6F3;

  /* Typography */
  --font-body:"Rubik",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-heading:"Nunito",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;

  /* Shape & depth */
  --radius-sm:6px; --radius:10px; --radius-lg:16px; --radius-xl:24px;
  --shadow-xs:0 1px 2px rgba(23,31,50,.05);
  --shadow-sm:0 2px 6px rgba(23,31,50,.07);
  --shadow:0 6px 18px rgba(23,31,50,.09);
  --shadow-lg:0 8px 40px rgba(23,31,50,.16);
  --transition:150ms ease;
}

html { scroll-behavior:smooth; font-size:18px; }
body { font-family:var(--font-body); background:var(--bg); color:var(--text); line-height:1.6;
       min-height:100vh; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
h1,h2,h3,h4,h5,h6 { font-family:var(--font-heading); font-weight:700; line-height:1.3; }
input,select,textarea,button { font-family:var(--font-body); }
a { color:var(--link); text-decoration:none; }
a:hover { color:var(--link-hover); }

:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.sidebar :focus-visible { outline-color:var(--brand-gold); }

@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin { to { transform:rotate(360deg); } }
.fade-in { animation:fadeIn .25s ease forwards; }
.spin { animation:spin .9s linear infinite; }

@media (max-width:768px) { html { font-size:16px; } }

@media (prefers-reduced-motion:reduce) {
  html { scroll-behavior:auto; }
  *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
}
```

**Recommended files to port directly:** `src/index.css`, `components/DashboardLayout.jsx`,
`Brand.jsx`, `Toast.jsx`, `ConfirmDialog.jsx`, `ErrorState.jsx`, `Skeleton.jsx`,
`FilterPills.jsx`, `ViewToggle.jsx`, `NavButton.jsx`, and `public/assets/branding/`.

---

## 13. Consistency checklist

Before shipping a screen in the new project, check that:

- [ ] Fonts are Rubik (body) and Nunito (headings), loaded with `display=swap`, and the root is 18 px (16 px ≤768 px).
- [ ] No raw hex appears in components; only semantic tokens (inline status triples from §3.3 are the one exception).
- [ ] There is exactly one gold CTA per view; secondary actions are `.btn-outline`.
- [ ] The active nav item has gold text, a gold-tint background and a 3 px gold left bar.
- [ ] Selected or active pills and choice cards use a gold border on a gold-tint background; segmented tabs use solid navy.
- [ ] Table headers are Nunito, uppercase, muted, on `#F3F2F0` with a 2 px gold-light underline; row hover is `#FFF8E6`.
- [ ] Cards are white with a 1 px `#E5E3DF` border, radius 10, `--shadow-xs`; hover gives `--shadow-sm` and a `#CCC` border.
- [ ] Overline labels are small, bold, uppercase, tracked and muted.
- [ ] Focus is visible (royal blue; gold on navy), and inputs show the gold 3 px ring.
- [ ] Loading uses skeletons matching the final layout, errors use `.error-state` with retry, and feedback uses toasts that dismiss after 3.5 s.
- [ ] Every Lucide icon follows the concept mapping in §9.
- [ ] The layout works at 380 px with no horizontal page scroll (tables scroll inside `.table-scroll`).
- [ ] Animations stop under `prefers-reduced-motion`.
