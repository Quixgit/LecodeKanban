# Audit log of verification

Facts about what was checked, with how. Update on every phase.

## W0 — sidebar and small UI fixes

- Verified: `tsc`, ESLint, Prettier, Vitest (incl. flyout focus/Escape test).
- **Not verified in a browser:** `frontend/e2e/sidebar-collapsed.spec.ts` (icon / highlight centre x
  = rail centre ±0.5 px at 1440 and 1024, light/dark, uk/en, screenshots into
  `docs/qa/sidebar-collapsed/`) is written but has not been run — it needs `make e2e`.
- Seed data in the repository has no junk card titles; the ones seen in the screenshot live in a
  local database and have to be edited or deleted there.

## W1 — wiki backend

- Verified against PostgreSQL 16: `go test -race ./...`, `go vet`, `gofmt`; migration 00011 up/down/up.
- Authorizer matrix: `internal/modules/wiki/domain/authorizer_test.go`.
- Cross-user leak tests (tree, node, access, favorites, recents, shared, trash, create-under, move,
  grant): `internal/modules/wiki/service/service_test.go`; over HTTP: `cmd/server/e2e_wiki_test.go`.
- Not run: `golangci-lint` (the installed binary is older than the module's Go version), Playwright
  and axe (no frontend for the wiki yet).

## W2 — wiki frontend

- Verified against a real stack (local PostgreSQL 16, the API from this branch, Vite): Playwright
  17/17 — sidebar centring (8 viewport/theme/language combinations + flyout), Kanban (5), Docs (3:
  folder → nested page → share → second user sees / doesn't see it → keyboard move → trash →
  restore; drag-and-drop nesting + keyboard navigation; axe wcag2a/2aa on the page and the share
  dialog). Vitest 139, `tsc`, ESLint and Prettier clean; locale parity and literal-key guards pass.
- A bug found by those tests and fixed: opening a just-created page briefly unmounted the tree
  (space unknown while the page loads), dropping the inline rename. The new page is now seeded in the
  query cache and the last space is kept.
- Not covered yet: virtualised tree with 5,000+ nodes (designed for it, not load-tested),
  screen-reader announcements verified only by code review, mobile layout checked by code only.

## W3 — wiki editor

- Verified against a real stack: Playwright for Docs (3) and the editor (9) — Markdown shortcuts,
  slash menu (table, callout, Mermaid), paste of Markdown, unsafe link refused, image upload that
  survives a reload, Markdown export/import round-trip, properties / verify / templates, offline
  edit then sync, version conflict stops autosave, read-only reader, axe wcag2a/2aa on the editor,
  slash menu and shortcuts dialog. Go tests with `-race` (document validator incl. XSS vectors,
  content conflicts, templates, files, properties), Vitest 178, `tsc`, ESLint, Prettier, build.
- Bugs found by those tests and fixed: server allow-list rejected table cell `align` and link
  `title` (422); Ctrl+K opened both the link dialog and the command palette; a link without a scheme
  was judged before `https://` was added; many spaces squeezed the tree to zero height.
- Not covered yet: orphaned uploaded files are not cleaned up; real-time co-editing (W4); card
  references and search (W5); mobile layout checked by code only.

## Chat

- Go: table-style service tests against PostgreSQL (`chat/service`): channel and DM access (private
  channels answer not-found, viewers read but cannot post, outsiders get nothing), auto-join on
  post, one-level threads and reply counters, reactions (closed set, idempotent), edit/delete rules
  with tombstones, unread and mention counts, cursor pagination, change hints; `-race`, vet, gofmt.
- Browser (Playwright against the real stack, two users): channel create → join → post → thread
  reply → reaction → edit → delete with live updates on the other side; DM with unread badges in the
  channel list and the main menu, cleared on open; axe wcag2a/2aa on the page, the open thread and the
  channel details dialog. Screenshots checked in light, dark and 390 px.
- Not covered yet: typing indicators and online presence, file attachments and message search in
  chat, push/email notifications for mentions, message history search, load test with large channels
  (history is paged by 40, not virtualised), realtime hints carry channel ids to every workspace
  member's stream (data is always fetched through the authorised API).

## Chat, second round

- Go (`chat/service`): attachments (sniffed type, sanitised name, unsent uploads private, cross-channel and
  cross-user attach refused, file-only messages, private channel files stay private), stars, saved, pins,
  threads and search (private channels never leak, wildcards literal), @channel counts and email
  addresses do not, presence and typing hints.
- Browser: attach image + document, pin, save, star, search, Saved and Threads pages; online dot and
  "is typing…" between two users.
- Not covered yet: virtual scrolling of very long histories, orphaned unsent uploads are not cleaned up,
  no link previews, no message scheduling or reminders.

## Chat, third round (task feeds, statuses)

- Go (`chat/service`): TestTaskFeeds (feed is read-only for people, project filter, card events become
  structured messages, delete/comment events) and TestStatuses (presets, custom text and icon, expiry,
  clear, invalid kind rejected).
- Browser: creating a feed channel and seeing a card event land with the sidebar highlight; setting a
  status that a second user sees, and do-not-disturb silencing sounds.
- Not covered yet: the feed toggle lives only in the chat dialogs (not in the Tasks settings), feeds for
  scoped project/card chats, bounce webhooks for Mailgun.

## Notifications and feed events

- Go: `notifications/service` (TestTaskNotifications: assignment on create and on edit, move/edit/comment
  reach the people on the task, the author is never notified, per-person read state, outsiders refused;
  TestChatNotifications: mention, @channel, muted members skipped for @channel but not direct mentions,
  direct messages, task conversations) and `chat/service` (TestFeedEventChoice: each event kind reaches
  only the feeds that take it, created-with-assignee counts as assigned, choice editable, own change is
  unread in a feed).
- Browser: assignment rings and shows a red count that opens the task; DM lands in the bell; a feed that
  takes only new assignments stays empty on create/move and badges the acting person.
- Not covered yet: notifications are never pruned; no email or push for offline people; no per-kind
  notification preferences; audio stays locked after a hard reload until the first click or key press (browser
  policy).
