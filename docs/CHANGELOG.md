# Changelog

## Unreleased

### Changed

- **Task window**: one Comments conversation (the card chat) replaces the separate comment list and Chat
  tab; the old comment UI and its client code are removed (the comments API and stored comments stay in the
  backend). The window can expand to full screen (remembered per browser; three columns on wide screens:
  details, conversation, side panel). The timer moved to the top of the side panel as a compact card
  (start/stop, "Log time" and "Entries" folds). Blocks are framed, the chat scrollbar only shows on hover,
  and two accessibility issues were fixed (definition list structure, attachment hint contrast).

### Added

- **Integrations module with Google Calendar** (ADR 0019): the Integrations page now lists connectable
  services as cards that can be connected, paused (Active switch), re-connected and disconnected. Google
  Calendar connects through OAuth (read-only access to events), syncs the next week every few minutes, and
  - shows the next meeting in the sidebar card (countdown, invited colleagues, Join button; the card also
    invites you to connect when nothing is connected),
  - reminds you shortly before it starts (5, 10, 15, 30 or 60 minutes): a pop-up, a sound and an entry in
    the notification bell that opens the video call,
  - optionally posts the reminder in a chat channel as a meeting card with a Join link.
  The server needs the Google client ID and secret it already uses for sign-in, the Calendar API enabled and
  `<LK_PUBLIC_URL>/api/v1/integrations/google_calendar/callback` registered as a redirect URI.

### Changed

- The static sidebar announcement (`VITE_TEAM_MEETING_URL`) is replaced by the live calendar card; the
  variable is gone.

- **Notifications (the bell)** (ADR 0018): a real inbox replaces the empty placeholder. People are told
  when they are assigned to a task, when a task they work on is moved, edited or discussed, when they are
  mentioned (`@name`, `@channel`, `@here`) and when they get a direct message. A red count sits on the bell,
  the list opens the task or conversation and marks items read, "Mark all as read" clears it, and a sound
  plays for new task notifications. The chat navigation badge turns red for mentions and task feeds.
- **Feed event choice**: a task-feed channel takes any mix of new tasks, new assignments, moves, edits,
  deletions and comments (create dialog and channel details). "New assignments" fires only when somebody is
  newly put on a task.

### Fixed

- **Task-feed messages never counted as unread for the person who made the change**, so testing a feed
  alone showed no badge and played no sound. Feed messages are now written by the system (the actor is in
  the card), so they count for everyone, the actor included.
- Dialogs taller than the window scroll instead of hiding their buttons.

- **Chat task feeds**: a channel can be flagged as a task feed (on create or in channel details) and
  optionally bound to one project. Card created, moved, edited, deleted and commented events arrive as
  Slack-bot-style cards; people cannot post in a feed. The channel highlights with a pulsing dot when new
  items arrive and plays the task sound.
- **Chat user statuses**: Available, Busy, Do not disturb, Away or a custom text and icon, with optional
  clear-after. Shown as a dot on avatars and a badge next to names; do-not-disturb silences notification
  sounds. Set from the chat sidebar or the user menu. The "available" icon and online dot use a soft mint token (`--c-available`).

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

- **Notification sounds**: short, synthesised signals (no audio files) for new chat messages, mentions,
  new tasks and new comments, played only for what is relevant (not your own actions, muted
  channels or the conversation you are reading). Volume, per-kind switches and previews live in the
  bell menu.

- **Docs export**: download a page as Markdown or HTML (one file, or a zip when it has attachments), a
  folder with everything below it, or a whole space as a zip with the folder structure, an index and
  the attachments. Done on the server from the stored document (tables, code, callouts, math,
  links between pages and images all convert), so it includes only what the caller may read.
- **Chat search like Slack**: one search entry, with `in:#channel`, `from:@person`, `has:link`,
  `has:file`, `is:thread`, `with:me` modifiers (typed or as chips), a date filter, "jump to"
  conversations and people. Emoji picker (search, categories, skin tones, frequently used) for
  messages and reactions; creating a channel can add people at once; a sound on/off toggle sits next to
  "new message". Migration `00016_chat_emoji`.

### Fixed

- Sign-in pages: one shared board-themed backdrop instead of a white half and a green half; the form sits in a card, the pitch and mini board on the same background; works in light and dark and on phones; the social sign-in buttons no longer squeeze their labels.
- Segmented controls (card tabs, view switcher) no longer keep a closed drawer or dialog mounted after a
  tab was changed: the sliding thumb uses a CSS transition instead of a shared framer layout.
- Docs: the space strip scrolls instead of squeezing the page tree when there are many spaces.
- Collapsed sidebar: icons and the active highlight are centred on the rail; Tasks sub-items open as
  a keyboard-accessible flyout with counts.
- Kanban toolbar stays on one row at ≥ 1280 px (overflow menu below); header subtitle wraps instead
  of truncating.
