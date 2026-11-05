# Manuscript — Style Reference

> Executive indigo on slate, with square geometry and hairline structure.

## Visual direction

Manuscript uses a crisp slate canvas (`#f8fafc`) with slate-ink text (`#0f172a`), an indigo action accent (`#6366f1`), and emerald status signals (`#10b981`). Hairline borders provide structure. Surfaces do not use shadows, gradients, blur, or decorative fills.

All cards, buttons, inputs, tags, dialogs, images, and grouped controls use square corners (`border-radius: 0`). Circular geometry is reserved for semantic status dots and loading spinners.

## Tokens

### Colors

| Name | Value | Role |
| --- | --- | --- |
| Indigo Accent | `#6366f1` | Primary actions and active states |
| Emerald Signal | `#10b981` | Success and availability indicators |
| Slate Paper | `#f8fafc` | Page and card surfaces |
| Slate Ink | `#0f172a` | Primary text and structural borders |
| Slate Graphite | `#64748b` | Secondary text and subtle dividers |
| Signal Red | `#dc2626` | Errors and destructive warnings |

### Typography

- Family: DM Sans with `"ss03"` and `"ss04"` enabled.
- Weights: 400 for prose, 500–600 for headings and controls.
- Sizes: 14, 16, 18, 20, 24, 28, and 64px.
- Display: 64px, weight 500, line-height 1.25, letter-spacing `-0.016em`.
- Body: 18px, line-height 1.5.
- Small labels: uppercase only when the role is metadata or a section eyebrow.

### Spacing and layout

- Base unit: 8px.
- Scale: 8, 16, 24, 32, 48, 64, 128, and 192px.
- Page max width: 1200px.
- Section gap: 64px.
- Card padding: 24–32px.
- Typical element gap: 16px.

### Shape and elevation

- Interface corner radius: `0`.
- Status dots and spinners may use `50%` radius.
- Default structural border: `1px solid #0f172a`.
- Subtle divider: `1px solid #64748b`.
- Box shadow: none.

## Components

### Primary button

Square corners, indigo fill, white text, 1px indigo border, and a minimum 44px target height. Use one dominant primary action per view where practical.

### Secondary button

Square corners, transparent fill, 1px slate-ink border, slate-ink text, and the same minimum target height as primary buttons.

### Cards and grouped surfaces

Use the slate-paper surface, square corners, a 1px slate-ink border, and no shadow. Cards should differ through spacing, hierarchy, and border treatment rather than elevation.

### Inputs and selects

Use square corners, a 1px slate-ink border, the slate-paper background, and a minimum 44px target height. Focus must remain visible with a 2px indigo outline and offset.

### Tags, counts, and badges

Use compact square labels with a 1px border. Do not turn labels into pills. Reserve circles for small state indicators only.

### Status indicators

Status dots may be circular because shape and color jointly communicate state. Use emerald for success, red for errors, and graphite for neutral or pending states.

## Do

- Keep the canvas and cards in the slate family.
- Use indigo for primary actions and active states.
- Use emerald only as a positive-state signal.
- Keep borders crisp and corners square.
- Preserve visible keyboard focus and native control semantics.
- Use responsive single-column layouts below the tablet breakpoint.

## Don’t

- Do not add rounded corners or pill-shaped controls.
- Do not add shadows, gradients, glass effects, or blur.
- Do not add a second body font or serif display font.
- Do not use green for primary actions.
- Do not expose secrets or provider keys in browser bundles.

## CSS custom properties

```css
:root {
  --color-paper: #f8fafc;
  --color-ink: #0f172a;
  --color-graphite: #64748b;
  --color-accent: #6366f1;
  --color-mint: #10b981;
  --color-signal: #dc2626;
  --font-dm-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --radius-interface: 0;
  --page-max-width: 1200px;
  --section-gap: 64px;
}
```
