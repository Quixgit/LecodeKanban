# Kanban visual pass — before / after

Screenshots: `docs/qa/kanban-before/` and `docs/qa/kanban-after/` (light + dark, en + uk, 1440 / 1280 / 1024 / 390).
Checked by Playwright (`frontend/e2e/kanban.spec.ts`, `make e2e`) and axe.

## Done

- **A Layout**: CSS-grid board, columns `minmax(17rem, 1fr)` fill the width (scroll + snap only when they don't fit); one shared inner padding gives header chips, lane titles and cards the same left edge; each lane is a grid row so cells have equal height and the add-card button lines up; sticky column headers with a shadow only when stuck; tinted column surface (`--c-surface-column`) and a status-coloured 8 % drag-over tint.
- **B Lanes**: chevron (rotates), project dot / avatar, semibold name, count pill (uk plurals), full-width divider, collapse animates height.
- **C Column headers**: panel-icon collapse button appears on hover/focus (always on touch) with tooltip; persistent "+"; WIP shown as "2 / 5" in the danger colour when exceeded.
- **D Add card**: ghost button on hover/focus, dashed drop-zone in empty cells.
- **E Cards**: nowrap meta row in a fixed order with "+N" overflow, avatar always bottom-right, 2-line title clamp, parent line below the title, max 2 labels + "+N", status-driven progress colour, due semantics (overdue red + icon, ≤2 days amber, full-date tooltip), `--shadow-card` + hover lift, min height.
- **F Toolbar**: single row at 1440, realtime dot (label from xl) with tooltip, tooltips on the bookmark / shortcuts buttons, clearer segmented control.
- **H Sidebar**: status dots + live counts on sub-items, shared-layout highlight for sub-items, `/tasks/<status>` narrows the board, announcement text wraps to 2 lines.
- **I States**: board skeleton on the same grid, empty state with CTA, error state with Retry.
- **J Perf**: 546 cards → 49 rendered, scroll p95 16.7 ms, 0 frames > 33 ms. Fixed a latent bug: cells with ≥ 60 cards (virtualized) rendered empty.
- Tokens: raw hex / rgb / arbitrary radius, shadow and px font sizes in `features/` and `pages/` now fail `make test` (`src/test/tokens.test.ts`).

## Deliberately skipped

- **G (brighter teal, mint background/sidebar)**: measured on the reference — buttons are `#4cb5ae` (already `--c-primary`), app background `#f9f9f9`, sidebar white. White text on `#4cb5ae` is 2.46:1 (fails AA), so the filled button stays `#36827d` (4.52:1). Say if you want a bright button with dark text instead.
- **8 / 35 (data)**: lowercase project names and junk card titles are in your own database, not in the seed; I did not touch your data.
- **Logo restyle (31)**, column min width is 272 px (not 280) so 4 columns fit at 1440 with the sidebar open.
