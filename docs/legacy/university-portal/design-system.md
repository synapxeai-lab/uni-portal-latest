# Design system — EITHM branding

The portal uses the brand identity of **Elevate Institute of Tourism & Hospitality
Management** (https://eithm.pk/). Colours, logo and favicon were extracted from the
live site on 2026-10-16 and not guessed. All tokens live in `:root` in
`apps/frontend/src/index.css`, the single source of truth.

## Brand assets

| File (`apps/frontend/public/assets/branding/`) | Source | Notes |
|---|---|---|
| `eithm-logo.png` (1620×580) | `https://eithm.pk/wp-content/uploads/2026/06/ChatGPT-Image-Jun-5-2026-04_41_28-PM-e1780658009101.png` | Official header & footer logo, untouched original. Opaque white background, so it always sits on a white plate. |
| `eithm-logo-540.png` (540×193) | Derived from the file above | Exact 1/3 linear-light area-average downscale, about 100 KB instead of 783 KB. This is what the UI loads; `srcset` falls back to the original on very dense screens. |
| `eithm-crest.png` (541×541), `eithm-crest-180.png` | Cropped from the header logo | Shield only, used for the collapsed sidebar and the login panel. Pixels are copied unchanged, with no redrawing. |
| `eithm-favicon-32.png`, `eithm-favicon-192.png` | `…/2026/03/cropped-cropped-EITHM-LOGO-yellow-and-Blue-1-copy-1-{32x32,192x192}.png` | The site's `rel="icon"` assets. |
| `eithm-apple-touch-icon.png` | `…-180x180.png` | The site's `rel="apple-touch-icon"`. |

The site publishes no SVG logo, so the original rasters are used. The favicon is the
site's older indigo/yellow crest, which is what eithm.pk itself still serves. It is kept as-is
rather than regenerated from the newer navy/gold logo.

## Extracted palette

Sources: the Educavo theme-options `<style>` block in the homepage head (navigation,
toolbar, footer, buttons), the site's `wp-custom-css` block, and pixel sampling of the logo.

| Token | Value | Where EITHM uses it |
|---|---|---|
| `--brand-navy` | `#171F32` | Toolbar background, menu link colour, footer, newsletter band |
| `--brand-navy-deep` | `#011B4B` | Logo shield navy (pixel-sampled) |
| `--brand-royal` | `#3F3C8F` | "Royal Blue" — table headers, emphasis (custom CSS) |
| `--brand-gold` | `#D9A11E` | Buttons, active and hover menu items, sub-menu borders |
| `--brand-gold-hover` | `#C08E19` | Button hover |
| `--brand-gold-light` | `#F2B233` | "Golden Yellow" table borders (logo gold ≈ `#F1A506`) |
| `--brand-gold-tint` | `#FFF8E6` | "Light yellow tone" striped rows |
| `--brand-gold-soft` | `#FFE9B3` | "Soft yellow hover" |
| `--bg` | `#F9F8F8` | Section background |
| `--text` | `#101010` | Headings |
| `--text-mid` | `#394459` | Paragraph text |
| `--border-dark` | `#CCCCCC` | Theme borders |
| `--nav-text-muted` | `#E0E0E0` | Footer / light-on-navy text |

**Not brand colours:** the Elementor kit globals (`#6EC1E4`, `#61CE70`, `#54595F`,
`#7A7A7A`) are Elementor's untouched defaults. `#FF5421` is the Educavo theme's demo
orange, which the site's custom CSS overrides with gold. Neither is used.

**Derived values** (not on eithm.pk; chosen to complete the scale): `--text-muted`
`#5F6675`, `--text-faint` `#8A909C`, `--border` `#E5E3DF`, `--surface-muted` `#F3F2F0`,
skeleton greys, role tints. Status colours (success / warning / error) are standard
semantic colours, not brand colours.

### Typography

Body text is **Rubik** and headings are **Nunito**. These are the fonts the theme loads and
assigns (`html, body` and `h1–h6`). Both load from Google Fonts with `display=swap`.

## How the brand is applied

- **Primary = navy, CTA = gold.** Gold buttons (`.btn-primary`) carry white text, as on
  eithm.pk. White on `#D9A11E` is only about 2.6:1, below WCAG AA (4.5:1); set `--cta-text`
  to `var(--brand-navy)` (about 6.3:1) if AA compliance is required. Other text-bearing
  states (links, active tabs, outlines, focus) use navy or royal blue.
- **Navigation** follows eithm.pk's menu. The sidebar is navy and the active item has gold
  text with a gold indicator bar. The logo sits on a white plate with a gold underline,
  lined up with the white top header.
- **Tables** use a gold header rule and a light gold hover row, echoing the site's tables.
- **Focus** is a 2px royal-blue outline on light surfaces and gold on the navy sidebar.
- **Motion:** every animation, including skeleton shimmer, stops under
  `prefers-reduced-motion`.
- The project has no dark mode, and none was added.

## Tokens to use

Use the semantic tokens (`--primary`, `--cta-bg`, `--link`, `--surface`, `--border`,
`--text*`, `--success/--warning/--error*`) rather than raw hex or `--brand-*` values.
Change a colour once in `:root`; the whole app follows.
