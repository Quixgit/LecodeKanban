# Changelog

## Unreleased

### Added

- **Docs (wiki) backend, phase W1** (ADR 0014): spaces, nested folders and pages with fractional
  ordering, per-space/folder/page visibility (private, shared, workspace) with inheritance, grants
  (owner, editor, commenter, viewer), one `domain.Resolve` authorizer with a table-driven matrix,
  move with cycle/depth checks and a confirmation when access would widen, trash with 30-day
  retention and restore, favorites, recents, "shared with me", "my private", per-space audit log,
  REST endpoints in `api/openapi.yaml` and migration `00011_wiki`.

- **Docs (wiki) UI, phase W2**: `/docs` with a resizable, collapsible page-tree panel, space strip
  (drop a page on a space to move it there), Favorites / Recent / Shared with me / My private
  sections, a virtualised ARIA tree (arrows, F2 rename, Delete, Alt+arrows move, context menu key),
  drag and drop with before / after / inside indicators, hover auto-expand and the same lift and
  settle as Kanban cards, confirmation before a move widens access, breadcrumbs with overflow,
  share dialog (visibility, people, effective access), space settings, trash, uk/en, outline Lucide
  icons only (no emoji), demo seed data.

### Fixed

- Collapsed sidebar: icons and the active highlight are centred on the rail; Tasks sub-items open as
  a keyboard-accessible flyout with counts.
- Kanban toolbar stays on one row at ≥ 1280 px (overflow menu below); header subtitle wraps instead
  of truncating.
