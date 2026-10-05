# Design tokens

Source of truth in code: `frontend/src/shared/styles/tokens.css` (CSS variables) →
`frontend/tailwind.config.ts` (utility names). Values were sampled pixel-by-pixel from the four
reference screenshots in `docs/design/` (Tasks list, Payrolls, Dashboard, Projects cards; captured @2x).

Colours are stored as RGB channels (`--c-primary: 76 181 174`) so Tailwind opacity modifiers work
(`bg-primary/20`). Every token has a light value (matches the screenshots) and a dark value
(`[data-theme='dark']`).

## Palette

### Brand

| Token            | Light     | Use                                                     |
| ---------------- | --------- | ------------------------------------------------------- |
| `primary`        | `#4cb5ae` | Fills, progress bars, icons, focus ring, chart series 1 |
| `primary-solid`  | `#36827d` | Primary button background (white text, AA 4.5:1)        |
| `primary-soft`   | `#e9f4f2` | Pale teal pill / progress track                         |
| `primary-subtle` | `#f5fbfb` | Active nav item background                              |
| `primary-border` | `#b2dfdf` | Active nav item border, announcement card border        |
| `primary-ink`    | `#327974` | Teal text on pale teal (AA)                             |

### Surfaces, borders, text

| Token            | Light     | Observed in screenshots                            |
| ---------------- | --------- | -------------------------------------------------- |
| `bg`             | `#f9f9f9` | Content canvas behind panels                       |
| `surface`        | `#ffffff` | Sidebar, header, cards, table body                 |
| `surface-muted`  | `#f9f9f9` | Table header row, segmented-control track          |
| `surface-sunken` | `#f4f4f4` | `⌘K` badge, disabled buttons ("Edit Project Info") |
| `border`         | `#ededed` | Controls, count badges                             |
| `border-subtle`  | `#f3f3f3` | Card outlines, row separators, column dividers     |
| `text`           | `#1c1c1c` | Headings, assignee names, values                   |
| `text-secondary` | `#525252` | Table cells, body copy                             |
| `text-muted`     | `#737373` | Labels ("PIC:", "Deadline:"), subtitles            |
| `text-faint`     | `#a1a1a1` | Placeholders, "/ 96" denominators                  |

> The brief mentions a "mint-tinted sidebar/background". In the screenshots the sidebar and header
> are pure white and the canvas is neutral `#f9f9f9`; mint appears only on the active nav item and the
> announcement card. Per the rules ("prefer the screenshot"), we follow the screenshots.

### Status & priority

Each tone has a **fill** (bars, dots, icons), a **soft** background (pill) and an **ink** (text on soft).

| Meaning             | Fill                      | Soft      | Ink (AA)  | Screenshot ink |
| ------------------- | ------------------------- | --------- | --------- | -------------- |
| To Do / neutral     | `#232323`                 | `#f1f1f1` | `#232323` | same           |
| In Progress / amber | `#e6b04b` (bar `#f2cc83`) | `#fcf7ea` | `#8c6b2d` | `#e6b04b`      |
| In Review / purple  | `#9474c2` (bar `#b89dda`) | `#eee8f7` | `#775d9d` | `#9474c2`      |
| Completed / teal    | `#4db6ae`                 | `#e9f4f2` | `#327974` | `#4cb5ae`      |
| Danger / High       | `#d0544e`                 | `#f7e7e6` | `#b04742` | `#dd8382`      |

Priority pills: **High = red**, **Medium = teal**, **Low = purple**. Project status pills: In progress =
amber (loader icon), Completed = teal (check), Pending = purple (flag), Overdue = red (triangle).
The pastel inks in the screenshots measure 1.8–3.5:1 and fail WCAG AA, so text uses darker inks of the
same hue — see [ADR 0002](adr/0002-accessible-color-inks.md).

Chart series (dashboard heatmap): `chart-1` teal `#4cb5ae`, `chart-2` lavender `#c4b2dd`,
`chart-3` sand `#f1cd83`.

Announcement card gradient: `#d1f1ef → #e6f6f5 → #f1f9fa` (160°).

## Radii

| Token  | Value  | Use                                     |
| ------ | ------ | --------------------------------------- |
| `xs`   | 6px    | kbd, trend chips                        |
| `sm`   | 8px    | small chips                             |
| `md`   | 10px   | small buttons, icon buttons (sm)        |
| `lg`   | 12px   | inputs, buttons, nav items, table frame |
| `xl`   | 16px   | cards, KPI tiles, dropdowns             |
| `2xl`  | 20px   | modals, page panels                     |
| `full` | 9999px | pills, avatars, progress bars           |

## Elevation

Very soft, large blur, low opacity; cards rely mostly on a 1px `border-subtle` outline.

| Token     | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| `xs`      | `0 1px 2px rgb(16 24 40 / .04)`                                  |
| `sm`      | `0 1px 2px /.03, 0 4px 12px -6px /.06` — cards at rest           |
| `md`      | `0 2px 4px /.03, 0 12px 32px -12px /.10` — hover elevation       |
| `lg`      | `0 4px 8px /.04, 0 24px 48px -16px /.16` — menus, modals, drawer |
| `drag`    | `0 8px 16px /.06, 0 28px 56px -12px /.24` — lifted Kanban card   |
| `primary` | `0 6px 16px -6px primary/.55` — teal glow under primary buttons  |
| `focus`   | `0 0 0 3px primary/.28` — focus ring                             |

## Spacing & layout

Tailwind's 4px scale. Layout constants:

| Token         | Value   | Notes                                   |
| ------------- | ------- | --------------------------------------- |
| `--sidebar-w` | 248px   | collapsed `76px`, animated              |
| `--header-h`  | 64px    | sticky, translucent white + blur        |
| `--row-h`     | 48px    | table row height                        |
| `--control-h` | 38px    | inputs, buttons, selects (`32px` small) |
| Page padding  | 24px    | `p-6` in `<main>`                       |
| Card padding  | 20px    | `p-5`; KPI tiles `16px`                 |
| Grid gap      | 16–24px | KPI row 16px, sections 24px             |

## Typography

Inter Variable (self-hosted via `@fontsource-variable/inter`, Latin + Cyrillic), features `cv11 ss01 ss03`.

| Token  | Size / line-height | Use                                                    |
| ------ | ------------------ | ------------------------------------------------------ |
| `2xs`  | 11 / 16            | kbd, captions                                          |
| `xs`   | 12 / 18            | section labels (uppercase, tracking-wide), trend chips |
| `sm`   | 13 / 20            | subtitles, field labels, pills                         |
| `base` | 14 / 22            | default UI text, table cells                           |
| `md`   | 15 / 24            | nav items, page title, card titles                     |
| `lg`   | 17 / 26            | panel titles ("Recent Activity Feed")                  |
| `xl`   | 20 / 28            | KPI tile values                                        |
| `2xl`  | 26 / 32            | —                                                      |
| `3xl`  | 32 / 38            | dashboard metric values ("81 / 96")                    |

Weights: 400 body, 500 labels/nav/active, 600 titles & values. Numbers use `tabular-nums` (`.tabular`).

## Iconography

Lucide, outline, stroke **1.6** (1.75 for small chevrons), 18–20px in nav/header, 16px in buttons.

## Components (geometry)

- **Avatar:** xs 24, sm 32, md 36, lg 44, xl 56; overlap `-10px` with a 2px surface ring.
- **Progress bar:** 8px (md) / 6px (sm), fully rounded, soft track of the same tone; fill animates
  with `scaleX` on mount.
- **Table:** rounded 12px frame, `surface-muted` header, vertical column dividers, 48px rows,
  sort icon `chevrons-up-down`.
- **Status group tag:** soft block with a 3×16px vertical bar + count badge (bordered square).
- **Segmented control:** muted track, white sliding thumb (`layoutId`), 38px tall.

## Motion

Defined in `frontend/src/shared/motion/presets.ts`, mirrored as CSS vars.

| Token   | Value                                                                 |
| ------- | --------------------------------------------------------------------- |
| easing  | `cubic-bezier(0.22, 1, 0.36, 1)`                                      |
| micro   | 140ms — hovers, presses, colour changes                               |
| ui      | 220ms — menus, submenu height, segmented thumb                        |
| large   | 320ms — sidebar width, drawers, page transitions                      |
| stagger | 35ms                                                                  |
| spring  | stiffness 520, damping 38 — drop settle, toasts, active-nav highlight |

`prefers-reduced-motion` zeroes CSS durations and `<MotionConfig reducedMotion="user">` disables
framer transforms.
