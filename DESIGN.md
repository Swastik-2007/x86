
# Manuscript — Style Reference

> executive indigo on slate, with hairline structure

**Theme:** light (with a slate dark variant)

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Manuscript uses a clean, modern executive language: a crisp slate canvas (#f8fafc) with a deep indigo primary accent (#6366f1) that reads as a brand stamp, not a highlighter. Almost the entire interface is achromatic — slate-ink text and 1px hairline borders do the structural work that shadows and fills do elsewhere. Typography is a single family (DM Sans) running from a whisper at 14px to a commanding 64px display, with generous 8px-grid breathing room and rounded 24px corners. Emerald (#10b981) appears sparingly as a status/availability signal and never competes with the indigo accent. This is meat on a slate re-theme: the dark mode swaps the slate-50 canvas for slate-900 (#0f172a) surfaces with indigo-400 (#818cf8) as the accent. The overall feel is crisp and executive — closer to a modern product dashboard than a paper notebook.

## Tokens — Colors

| Name               | Value       | Token                          | Role                                                                                              |
| ------------------ | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Indigo Accent      | `#6366f1` | `--color-sunshine` | Primary action fill, primary buttons, active states, callout backgrounds  |
| Emerald Signal     | `#10b981` | `--color-mint`        | Positive status dots, success indicators, availability signal |
| Slate Paper        | `#f8fafc` | `--color-paper`        | Page canvas, card surfaces, pill interiors                        |
| Slate Ink          | `#0f172a` | `--color-ink`                | Primary headings, body text, 1px hairline borders on cards, images, and dividers                  |
| Slate Graphite     | `#64748b` | `--color-graphite`           | Secondary body text, link text, muted borders and dividers                                        |

## Tokens — Typography

### DM Sans — Single-family system carrying everything from body copy to 64px display headlines. Weight 400 for prose, 500 for headings, step badges, and button labels. Activating ss03 and ss04 stylistic alternates gives DM Sans a more humanist, slightly editorial character that suits the precise, executive character of the system. · `--font-dm-sans`

- **Substitute:** Inter, Nunito Sans
- **Weights:** 400, 500
- **Sizes:** 14, 16, 18, 20, 24, 28, 64
- **Line height:** 1.25–2.22
- **Letter spacing:** -0.016em on display headings, +0.286em on uppercase step badges
- **OpenType features:** `"ss03", "ss04"`
- **Role:** Single-family system carrying everything from body copy to 64px display headlines. Weight 400 for prose, 500 for headings, step badges, and button labels. Activating ss03 and ss04 stylistic alternates gives DM Sans a more humanist, slightly editorial character that suits the precise, executive character of the system.

### Type Scale

| Role       | Family | Weight | Size | Line Height | Letter Spacing | Token                 |
| ---------- | ------ | ------ | ---- | ----------- | -------------- | --------------------- |
| caption    | —     | —     | 14px | 1.5         | 0px            | `--text-caption`    |
| body-sm    | —     | —     | 16px | 1.5         | 0px            | `--text-body-sm`    |
| body       | —     | —     | 18px | 1.5         | 0px            | `--text-body`       |
| subheading | —     | —     | 20px | 1.5         | 0px            | `--text-subheading` |
| heading-sm | —     | —     | 24px | 1.5         | 0px            | `--text-heading-sm` |
| heading    | —     | —     | 28px | 1.25        | 0px            | `--text-heading`    |
| display    | —     | —     | 64px | 1.25        | -1.02px        | `--text-display`    |

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token             |
| ---- | ----- | ----------------- |
| 8    | 8px   | `--spacing-8`   |
| 16   | 16px  | `--spacing-16`  |
| 24   | 24px  | `--spacing-24`  |
| 32   | 32px  | `--spacing-32`  |
| 48   | 48px  | `--spacing-48`  |
| 64   | 64px  | `--spacing-64`  |
| 128  | 128px | `--spacing-128` |
| 192  | 192px | `--spacing-192` |

### Border Radius

| Element | Value  |
| ------- | ------ |
| tags    | 9999px |
| cards   | 24px   |
| images  | 12px   |
| inputs  | 6px    |
| buttons | 24px   |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 64px
- **Card padding:** 32px
- **Element gap:** 16px

## Components

### Indigo Filled Button

**Role:** Primary action

24px radius, #6366f1 fill, #ffffff text, 16px 24px padding, DM Sans 500. Centered text, used for the main primary conversion. Single instance per view — indigo is rationed.

### Ghost Ink Button

**Role:** Secondary action

24px radius, transparent fill, 1px #0f172a border, #0f172a text, 16px 24px padding, DM Sans 500. Pairs with the indigo button or stands alone on neutral contexts.

### Numbered Step Badge

**Role:** Section index marker

Pill (9999px radius) split into two zones: a left 24x24 slate square with #0f172a numeral at 14px 500, and a right zone with the step name in uppercase 14px 500 letterspaced +0.286em. 1px #0f172a border surrounds the whole pill. Identifies '1 EASY START', '2 INSTANT OUTPUT', '6 GOOD COMPANY'.

### Feature Card

**Role:** Two-up feature content

Cream (#f8fafc) surface, 24px radius, 1px #0f172a hairline border, 32px padding, no shadow. Heading in 24px DM Sans 500, body in 18px #64748b. Cards define themselves through outline, not fill.

### Filter Tag Pill

**Role:** Active filter chip

24px radius, near-white (#f8fafc) fill, 1px #0f172a border, 14px DM Sans 500 with a leading icon. Used for the 'Pages / Entry Pages / Exit Pages / Referrers / Sources' tag set and the dark 'Country is Germany' variant.

### Dark Filter Chip

**Role:** Applied filter state

24px radius, #0f172a fill, #f8fafc text, 14px DM Sans 500, with a trailing × dismiss. Contrasts with the light filter tags to show applied state.

### Logo Grid Cell

**Role:** Social proof / customer logos

Transparent, no border, centered monochrome wordmark or mark in #0f172a. 8-column responsive grid with 32px gap. Logos are rendered as raw shapes on the slate canvas — no card wrappers.

### Display Headline

**Role:** Page section hero

64px DM Sans 500, #0f172a, letter-spacing -0.016em (~-1.02px), line-height 1.25. Centered, sits below a step badge with 32px gap. Carries the editorial weight of the whole page.

### Section Subhead

**Role:** Supporting paragraph

18px DM Sans 400, #64748b, max-width ~640px, centered. Voice is instructional and plain — sits 16px below the display headline.

### Status Dot Badge

**Role:** Live / happy state indicator

24px radius pill or 12px circle, #6ece9 fill with optional #0f172a label. Used sparingly for the 'happy customer' indicator and the theme-toggle dot in the corner.

### Bordered Avatar Tile

**Role:** Brand mark display

48px (or similar) square with 12px radius, slate fill, 1px #0f172a border, centered monochrome icon. Used for the Manuscript logo lockup in the CTA block.

### CTA Block

**Role:** Final conversion section

Centered stack: avatar tile (12px radius) → 64px display question → 18px #64748b subtext → indigo button. 64px section padding top and bottom. The whole page resolves here.

### Image Frame

**Role:** Inline image border

12px radius, 1px #0f172a border, no shadow. Gives every product screenshot a printed-on-paper feel.

## Do's and Don'ts

### Do

- Use #6366f1 (Indigo Accent) for the single primary CTA per view; never fill large surfaces or backgrounds with it.
- Define cards and tiles with 1px #0f172a hairline borders at 24px radius — never use drop shadows for elevation.
- Set display headlines at 64px DM Sans 500 with -0.016em letter-spacing; this is the structural anchor of every section.
- Use uppercase DM Sans 500 with +0.286em letter-spacing for step badges and small labels only; leave body copy untracked.
- Keep the slate (#f8fafc) canvas unbroken across sections — alternate rhythm through spacing and border weight, not background color.
- Activate DM Sans stylistic alternates 'ss03' and 'ss04' globally; they carry the humanist character of the system.
- Reserve #10b981 (Emerald Signal) for status dots and positive state chips; it is a signal, not a brand color.

### Don't

- Don't add drop shadows, blurs, or any form of box-shadow elevation — the system is intentionally flat and hairline-structured.
- Don't introduce a second body font or a serif — DM Sans at multiple weights is the entire typographic voice.
- Don't use pure white (#ffffff) as a page canvas — #f8fafc keeps the slate family consistent.
- Don't set body or caption text in #0f172a when #64748b reads cleanly; reserve ink for headings and emphasis.
- Don't use the indigo (#6366f1) on body text at small sizes on the slate canvas; prefer #64748b for secondary text.
- Don't use the green (#10b981) as a CTA or button background — it is a status signal, not an action color.
- Don't add gradients, image overlays, or decorative fills — the system is flat color, 1px lines, and one accent swatch.

## Surfaces

| Level | Name             | Value       | Purpose                                                                                                                |
| ----- | ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0     | Slate Page       | `#f8fafc` | Base canvas — crisp slate background that carries the whole system                                                     |
| 1     | Slate Card       | `#f8fafc` | Cards sit on the same slate but are defined by 1px ink hairline borders and 24px radius, not by color contrast |
| 2     | Indigo Callout   | `#6366f1`  | Indigo surface used for primary CTAs and step-number badges — the only chromatic surface in the stack |

## Elevation

The system has effectively zero shadow elevation. Cards, images, and tiles are defined entirely by 1px #0f172a hairline borders on the slate surface — the visual logic of drawn lines, not of floating layers. No drop shadows, no inner glow, no blur. If a component needs to feel above the page, raise its border weight or switch to the indigo surface — never add a shadow.

## Imagery

Imagery is restrained and functional: monochrome product screenshots (dashboard tiles, filter chips, data tables) framed by 1px ink borders at 12px radius, never full-bleed. Customer logos appear as raw monochrome wordmarks on the slate canvas, no card wrappers or color treatments. The Manuscript brand mark is a single ink glyph on slate. No photography, no illustrations, no decorative graphics — the only color in the visual system comes from the two accent swatches, and they appear as flat fills, never as gradients or tinted images.

## Layout

Centered, max-width 1200px container with generous 64px section gaps. The page reads as a vertical scroll of editorial bands: logo cloud → numbered step → display headline → centered subtext → two-up feature cards → logo cloud → CTA. All hero sections are centered stacks on the slate canvas — no split text/image compositions, no asymmetric layouts. Feature sections use a 2-column card grid at 32px column gap; logo clouds use a 4–8 column grid. Navigation is minimal: a small wordmark, no sticky header, no sidebar. Density is comfortable and breathy — each section gets full vertical room to settle before the next begins.

## Agent Prompt Guide

Quick Color Reference

- background: #f8fafc (Slate Paper)
- text primary: #0f172a (Slate Ink)
- text secondary: #64748b (Slate Graphite)
- border: 1px #0f172a hairline
- accent: #6366f1 (Indigo Accent)
- status: #10b981 (Emerald Signal)
- primary action: #6366f1 (filled action)

Example Component Prompts

1. Create a centered hero section on #f8fafc: a pill step badge (24px radius, 1px #0f172a border, 14px DM Sans 500 with +0.286em letter-spacing, left 24x24 cell with numeral) above a 64px DM Sans 500 headline in #0f172a with -0.016em letter-spacing, then an 18px #64748b subtext capped at 640px wide.
2. Build a feature card: #f8fafc fill, 24px radius, 1px #0f172a border, 32px padding, 24px DM Sans 500 heading in #0f172a, 18px #64748b body. No shadow.
3. Create an indigo CTA button: #6366f1 fill, #ffffff text, 24px radius, 16px 24px padding, DM Sans 500. Center it below the subtext with 32px gap.
4. Build a filter tag row: 24px radius pills, #f8fafc fill, 1px #0f172a border, 14px DM Sans 500 label, 8px gap between tags, 16px row padding.
5. Create a logo cloud: 4-column grid, 32px gap, each cell contains a centered monochrome #0f172a wordmark on transparent slate — no card wrapper, no border.

## Stroke & Border System

Hairline borders are the primary structural device. Default to 1px solid #0f172a on every card, image, input, and grouped element. Use 1px #64748b for subtle dividers between text blocks. Border radius is bold and consistent: 24px for cards, buttons, and large tiles; 12px for images and smaller tiles; 9999px (pill) for tags and step badges; 6px for form inputs. The 24px card radius paired with 1px ink borders is the single most recognizable shape in the system — it gives every container a sticky-note, hand-drawn quality.

## Two-Accent Discipline

The system is 0% colorful at the structural level, so its two accent colors must be used with restraint. #6366f1 is rationed: one filled CTA per view, plus small callout fills. #10b981 is rationed further: status dots, live indicators, and the occasional positive chip. In dark mode the same roles map to indigo-400 (#818cf8) on slate-900 (#0f172a) surfaces. Both colors function as the only chromatic punctuation — if you find yourself using them for structural UI (nav, large backgrounds, multiple buttons), the section has lost the calm that defines the system.

## Similar Brands

- **Stripe** — Same single-family sans (DM Sans / Inter lineage), generous whitespace, and a near-monochrome palette that lets a single accent color carry the hierarchy
- **Linear** — Same hairline-border-on-light-surface logic with no drop shadows, and the discipline of rationing color to one vivid accent per view
- **Notion** — Same warm off-white canvas, rounded 20–24px card radii, and a minimal two-tone accent system that reads as paper rather than screen
- **Fathom Analytics** — Direct competitor in the privacy-analytics space with the same editorial single-accent approach, off-white canvas, and 64px-class display headlines

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-sunshine: #6366f1; /* primary accent */
  --color-mint: #10b981;
  --color-paper: #f8fafc;
  --color-ink: #0f172a;
  --color-graphite: #64748b;

  /* Typography — Font Families */
  --font-dm-sans: 'DM Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.5;
  --tracking-caption: 0px;
  --text-body-sm: 16px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: 0px;
  --text-body: 18px;
  --leading-body: 1.5;
  --tracking-body: 0px;
  --text-subheading: 20px;
  --leading-subheading: 1.5;
  --tracking-subheading: 0px;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.5;
  --tracking-heading-sm: 0px;
  --text-heading: 28px;
  --leading-heading: 1.25;
  --tracking-heading: 0px;
  --text-display: 64px;
  --leading-display: 1.25;
  --tracking-display: -1.02px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-128: 128px;
  --spacing-192: 192px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 64px;
  --card-padding: 32px;
  --element-gap: 16px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;

  /* Named Radii */
  --radius-tags: 9999px;
  --radius-cards: 24px;
  --radius-images: 12px;
  --radius-inputs: 6px;
  --radius-buttons: 24px;

  /* Surfaces */
  --surface-paper-page: #f8fafc;
  --surface-paper-card: #f8fafc;
  --surface-accent-callout: #6366f1;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-sunshine: #6366f1; /* primary accent */
  --color-mint: #10b981;
  --color-paper: #f8fafc;
  --color-ink: #0f172a;
  --color-graphite: #64748b;

  /* Typography */
  --font-dm-sans: 'DM Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.5;
  --tracking-caption: 0px;
  --text-body-sm: 16px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: 0px;
  --text-body: 18px;
  --leading-body: 1.5;
  --tracking-body: 0px;
  --text-subheading: 20px;
  --leading-subheading: 1.5;
  --tracking-subheading: 0px;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.5;
  --tracking-heading-sm: 0px;
  --text-heading: 28px;
  --leading-heading: 1.25;
  --tracking-heading: 0px;
  --text-display: 64px;
  --leading-display: 1.25;
  --tracking-display: -1.02px;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-128: 128px;
  --spacing-192: 192px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
}
```
