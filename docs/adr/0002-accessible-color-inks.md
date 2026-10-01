# 0002 — Accessible "ink" shades for status text and primary buttons

- Status: accepted
- Date: 2026-10-01

## Context

The reference screenshots render coloured text directly in the fill colour on pastel backgrounds,
e.g. amber `#e6b04b` on `#fcf7ea` and white on teal `#4cb5ae`. Measured contrast:

| Pair | Ratio |
| --- | --- |
| teal `#4cb5ae` on `#e9f4f2` | 2.19 |
| amber `#e6b04b` on `#fcf7ea` | 1.84 |
| purple `#9474c2` on `#eee8f7` | 3.16 |
| red `#d0544e` on `#f7e7e6` | 3.46 |
| white on teal `#4cb5ae` (button) | 2.46 |

The brief requires both pixel fidelity and WCAG AA (4.5:1 for normal text). They conflict here.

## Decision

Each tone gets three tokens: **fill** (screenshot colour, used for bars, dots, icons, borders —
non-text graphics that only need 3:1), **soft** (screenshot background) and **ink** (same hue,
darkened to ≥ 4.5:1 on its soft background). Primary buttons use `primary-solid` `#36827d`
(4.52:1 with white) while the brand teal `#4cb5ae` stays on progress bars, focus rings, icons and charts.

## Consequences

- Pills and buttons read slightly deeper than the screenshots; layout, shape and hue are unchanged.
- If the product later decides fidelity beats AA, only `--c-*-ink` and `--c-primary-solid` in
  `tokens.css` need to change.
