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

- **Docs editor, phase W3** (ADR 0015): TipTap page editor in its own `features/wiki-editor`
  module (lazy chunk) with Markdown shortcuts, paste and import/export, slash menu, bubble menu,
  tables, task lists, callouts, toggles, code blocks (highlighting, HCL, live Mermaid preview),
  math, YouTube, image and file uploads, outline, shortcuts dialog, autosave with offline retry and
  conflict handling. Backend: versioned page content with a server-side document allow-list
  (unsafe links, scripts and non-https images are refused), page properties (status, tags, review
  interval and "verified", full width, project links), eight built-in and custom templates, files
  with sandboxed downloads; migration `00012_wiki_content`.

- **Team chat** (ADR 0016): `/chat` with public and private channels, direct and group
  conversations (and notes to self), one-level threads, @mentions, eight outline-icon reactions
  (no emoji), edit and delete, per-channel unread and mention counts with a badge on the Chat menu
  item, mute, browse and join, topic and member management, drafts kept per conversation, live
  updates over the existing SSE stream, uk/en, light/dark, keyboard flow (Enter sends, Shift+Enter
  breaks the line). New module `chat` and migration `00013_chat`.

- **Chat inside the Kanban**: the board of a project has a "Project chat" drawer (unread badge on the
  toolbar button) and every card has a "Chat" tab, using the same feed, threads, reactions and
  mentions as `/chat`. One conversation per project or card, created on first use; they never show
  in the channel list. Migration `00014_chat_scopes`.
- **Email through Mailgun** (ADR 0017): `LK_MAIL_PROVIDER=mailgun` sends invitations and the
  email-confirmation message through the Mailgun HTTP API (SMTP stays the default for development).

- **Chat, second round**: attachments (file picker, drag and drop, paste; image previews with a viewer,
  file cards), @channel / @here mentions that count as a mention for every member, starred
  conversations, pinned messages, saved ("Later") messages, a Threads page, message search across
  conversations (Ctrl+Shift+F), channel tabs (Messages, Pins, Files), online dots, "is typing…",
  reply avatars on thread summaries. Migration `00015_chat_extras`.

### Fixed

- Segmented controls (card tabs, view switcher) no longer keep a closed drawer or dialog mounted after a
  tab was changed: the sliding thumb uses a CSS transition instead of a shared framer layout.
- Docs: the space strip scrolls instead of squeezing the page tree when there are many spaces.
- Collapsed sidebar: icons and the active highlight are centred on the rail; Tasks sub-items open as
  a keyboard-accessible flyout with counts.
- Kanban toolbar stays on one row at ≥ 1280 px (overflow menu below); header subtitle wraps instead
  of truncating.
