# Changelog

## Unreleased

### Added

- **Export tasks** (Settings → Data & export): download the workspace's tasks, or one project's, as a CSV that opens in
  Excel, Numbers and Google Sheets (UTF-8, cells that look like formulas are neutralised). New permission **Export data**
  (`data.export`): administrators have it by default; it can be given to any role.

### Added

- **Two-step verification (2FA)**: Profile → Security → turn on with any authenticator app (QR code or key), get
  8 one-time recovery codes, sign in with password + code, turn off with password + code, make new recovery codes.
  Accounts with it on cannot sign in with Google/GitHub (use email and password). Needs migration `00030`
  (ADR 0025).
- **Chat appearance** (palette button in the chat header): eight ready-made themes (Aubergine, Ocean, Forest…) or your
  own sidebar and accent colours. The text colour, borders and the active row follow the colours and stay readable
  (AA); the choice is remembered per browser.

### Added

- **Icon-rail menu** (optional, "Icon menu" button at the bottom of the sidebar; "Classic menu" switches back; the
  choice is remembered). A strip of icons, then — for Projects, Tasks, Integrations and Settings — a second column
  with that section's menu (projects, task statuses with counts, modules, settings sections), then the content. In
  this mode the admin centre does not repeat its own section list.

### Changed

- **Integrations**: one look for every module. A card opens the module's own page (`/integrations/<module>`) with
  a header (status, Active switch) and its settings or, when the server is not set up yet, the setup steps. The
  side panels and the setup dialog are gone.

### Changed

- **Fields** (inputs, text areas, selects, the chat composer) share one look: a soft mint outline on hover and a
  stronger one while typing.
- **Close buttons** (windows, side panels, thread, notifications) are one soft tile whose cross turns on hover.
- **Tooltips** are now styled cards (surface, border, shadow) instead of plain dark chips.
- **Dashboard**: every KPI has a trend chip (percent, or absolute change when there is nothing to compare with),
  green/red by meaning (a growing backlog is red), and a small sparkline. Active tasks show the net change.
- Removed the "Live" indicator from the board. Settings keeps its section list still while the content changes
  (less flicker).

### Added

- **Roles & permissions** (Settings → Roles): about 25 permissions in groups. Change what Admin, Member and Viewer
  may do (and reset to defaults), or create custom roles (start blank or from a role), assign them in Team, delete
  them. The Owner keeps everything. The old "who can invite / create projects / create channels / @channel"
  settings became permissions (ADR 0024). Needs migration `00029`.

### Changed

- **Integrations page**: services are cards in a grid (no longer one stretched card). Each card has an
  **Active** switch and a **Settings** button that opens a side panel; a provider the server cannot use yet
  says **Needs setup**, and **How to set up** shows the exact steps and the redirect address to copy (also in
  `docs/INTEGRATIONS.md`). Disconnecting asks inside the panel.
- **Kanban of a single status** (Tasks → To Do and the like): the lone column no longer stretches its cards
  across the whole screen; columns grow only up to a sensible width.
- Presence and status dots next to avatars are smaller.
- **Task window**: one Comments conversation (the card chat) replaces the separate comment list and Chat
  tab; the old comment UI and its client code are removed (the comments API and stored comments stay in the
  backend). The window can expand to full screen (remembered per browser; three columns on wide screens:
  details, conversation, side panel). The timer moved to the top of the side panel as a compact card
  (start/stop, "Log time" and "Entries" folds). Blocks are framed, the chat scrollbar only shows on hover,
  and two accessibility issues were fixed (definition list structure, attachment hint contrast).

### Changed

- **Profile is its own page** (`/profile`, opened from the account menu at the top right), with tabs *Profile* and
  *Security*. It no longer repeats language, theme and notification sounds (they are in the header). New fields:
  job title, phone, location, time zone (with a "use this device's time zone" button) and an about text. The old
  `/settings/profile`, `/settings/security` and `/settings/preferences` addresses redirect.

### Fixed

- **Dashboard trends**: the "Completed" and "New" cards showed +0.00% whenever the previous period had nothing to
  compare with, and always compared fixed weeks. They now follow the selected period (7 / 14 / 30 days against the
  period before it) and show "New" or "No change" instead of a fake percentage. `changePct` in the API is `null`
  when there is no baseline.

### Changed

- **Dashboard trends are back**: the green up / red down arrows with a percentage return. When the previous period had
  nothing to compare with, the arrow shows how many more (or fewer) tasks there are (`+5`), and a flat dash when nothing
  changed, instead of a meaningless `+0.00%`.
- **Chat channel menu** now follows Slack: *Channel details ›* (View channel details, Search in channel), *Copy ›*,
  *Star channel*, the three notification choices right in the menu with a tick, *More options ›* (Temporarily mute for
  1 hour, 4 hours, until tomorrow or next week; mark as read; open in a new tab; advanced settings), *Open in split view*
  (also opt/alt + click) and *Leave channel*. Temporary mutes lift by themselves. API: `PUT …/notify` takes `until`.
- **Chat header**: the member avatars and the second "info" icon (both opened the same window) are replaced by one
  button. The window it opens now has tabs: About (name, topic, task feed, links to pins and files, leave / archive),
  Members (searchable, add people) and Notifications (the three levels, temporary mute).

### Added

- **Email page in the admin centre** (Settings → Email): shows how the server sends mail (SMTP or Mailgun), warns plainly
  when mail only goes to a test inbox such as Mailpit (the default of a fresh deployment, which is why invitations never
  reached real inboxes), the queue (waiting / failed), the latest emails to the workspace's people with their errors, and
  a *Send me a test email* button. It lists the `.env` lines to connect a real provider.
- **Invitation link**: after inviting, the dialog shows the link with a copy button, so an invitation can be handed over
  by hand when an email does not arrive.
- **Split view in chat**: a second conversation next to the open one, with its own threads and tabs.

- **Admin centre redesigned and extended**: one card of grouped sections (Workspace, People, Work, System) with an
  animated highlight, tiles with a short status on the overview, and every setting as a row with its control, saved
  at once. New sections:
  - **Modules**: switch Chat, Docs, Calendar, Time tracking and Integrations off for the workspace (hidden from the
    menu, pages say "switched off", data is kept).
  - **Access & invitations**: who can invite (admins or every member), default role, invitation lifetime (1-30 days) and
    allowed email domains.
  - **Rules & defaults**: who creates projects and channels, who may use @channel, default task priority, require a due
    date, and the calendar week start (Monday or Sunday).
  - **General**: now also a workspace description.
  - **Audit log**: who changed settings, roles, invitations or the workspace name, and when.
  Rules are enforced by the server, not only hidden in the interface (ADR 0023).

- **Profile background**: pick one of eight ready-made backgrounds or upload your own picture (cropped to a wide strip
  in the browser); it shows in the profile header and on your teammate card.
- **More about you** on the profile: pronouns, LinkedIn, Telegram, website, working hours, skills (tags) and an
  introduction. Addresses are tidied on save (`peter-g` becomes the full LinkedIn address, `@name` or `t.me/name`
  becomes the bare name) and wrong ones are refused. A save bar appears when something changed.
- **Teammate card**: click a name or avatar in a chat message, an @mention, the channel's member list or the Team
  page to see who someone is: background, role, position, local time and whether they are in working hours, how to
  reach them (email, phone, Telegram, LinkedIn, website), skills, about, and a *Send message* button. Visible to people
  in the same workspace. API: `GET /workspaces/{id}/members/{userId}`.

- **`adduser` command** (`make adduser`, `/app/adduser` in the image): creates verified accounts with a random one-time
  password and adds them to a workspace; see README → Creating accounts.
- **Settings is now the admin centre** (sidebar → Settings): an overview of every area with live counts, and a
  section list with an animated highlight. Sections: *General* (workspace name, address, delete with typed
  confirmation for the owner), *Custom fields*, *Labels* (create, recolour, rename, delete); *Members & roles* and
  *Integrations* open their own pages. People who are not administrators can look but not change.
- **Custom fields for cards** (ADR 0022): administrators define text, number, date, choice (with coloured options),
  checkbox and link fields, reorder them and choose which show as chips on the board. They appear in the task
  window under "Custom fields" for anyone who can edit the task, and persist per task.

- **Channel context menu** in Chat: right-click a channel (or conversation) in the sidebar for *Channel details*,
  *Copy* (name, link, ID), *Star channel*, *Notify you about…*, *More options* (mark as read, open in a new tab)
  and *Leave channel*.
  - Notification levels per channel: **All new posts**, **Just mentions** (badge and sound only for @you and
    @channel) and **Mute and hide** (no alerts; the channel moves to a collapsed *Muted* section). The same choice
    is in the channel details dialog. API: `PUT /chat/channels/{id}/notify` replaces `…/mute`.

- **Settings pages** (`/settings`, ADR 0021): the Profile page that used to be empty is now a settings area with
  three sections.
  - **Profile**: profile photo (pick or drop a picture; it is cropped to a square and shrunk in the browser,
    then stored; remove it any time), full name, email with verification status and a resend link, member
    since, and which sign-in methods the account has.
  - **Security**: change the password (or set one for provider-only accounts) with a strength meter, and
    **Where you are signed in**: every device with browser, system, address and last activity, sign one out or
    all the others.
  - **Preferences**: language, light / dark / device theme, and notification sounds.
  The header and everyone else's lists show the new photo straight away.

- **GitHub integration** (ADR 0020, `docs/INTEGRATIONS.md`): connect GitHub once per workspace with an
  access token, link projects to repositories (the webhook is registered for you), and the two sides follow
  each other. Pull requests and issues that mention a task key such as `PLT-12` appear on the task, an
  opened pull request moves it to In review and a merge to Done; a new issue becomes a task; moving a task
  to Done closes its issue and moving it out reopens it; moving a task comments on its pull requests; a task
  can open a GitHub issue and suggests a branch name. Every rule is a switch.

### Fixed

- **Type checking was not running.** `tsc --noEmit` at the root checks nothing in this project (it uses
  project references; the right command is `npm run typecheck`). Running it found real errors that are now
  fixed: a duplicated prop in the channel details dialog, a missing export, stale test fixtures, and a
  required field missing from the sidebar card.

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
