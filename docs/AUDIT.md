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

## Integrations (Google Calendar)

- Go: `integrations/service` (TestConnectFlow: unconfigured server, forged and expired state, token stored
  sealed, sync, per-person visibility, outsiders refused; TestMeetingReminders: reminder once inside the
  lead window, bell and channel post, paused and bell-off silence, all-day events never ring;
  TestSettingsAndDisconnect: lead choices, foreign channels refused, revoked grant marks the connection
  for reconnecting, disconnect removes events) and `integrations/google` (OAuth URL asks for offline
  read-only access, token exchange, event parsing: cancelled/declined dropped, video entry point, all-day,
  rooms excluded, revoked grant).
- Browser (needs the stand-in Google, `E2E_FAKE_GOOGLE=1`): connect round trip, sidebar announcement,
  pop-up + bell + channel card for a meeting inside the lead window, pause/resume, lead choice, disconnect.
- Not covered yet: Google's own consent screen and verification (the app must be added to a Google Cloud
  project; calendar scopes need app verification for public use), only the primary calendar is read,
  no per-event muting, no email or push for offline people, other providers (Slack, GitHub, Gmail).

## GitHub integration

- Go: `github/domain` (task keys in titles, branches and bodies; branch suggestions; the marker hidden in
  issues the app creates) and `github/service` (TestConnectAndLinkRepos: administrators only, rejected tokens,
  webhook registered with the secret and address, one repository per project, reconnecting keeps the
  secret, unlink/disconnect remove hooks; TestWebhookIsAuthenticated: forged and unknown deliveries refused,
  paused connection ignored; TestPullRequestsMoveTasks: draft, ready for review, branch and body keys,
  several tasks per pull request, merge, close without merge, rules off, no echo to GitHub;
  TestIssuesAndCardsFollowEachOther: issue becomes a card once, close/reopen move it, issues created from
  a task do not duplicate, Done closes and reopens the issue, sync off is silent;
  TestMovingATaskCommentsOnItsPullRequest; TestCardPanel).
- Browser (needs the stand-in GitHub, `E2E_FAKE_GITHUB=1`): rejected and accepted tokens, linking a project,
  rule switches, forged webhook refused, a signed pull request links and moves a task, a merge finishes it,
  branch name and issue creation, Done closes and reopens the issue, an issue becomes a task, disconnecting
  removes the webhook.
- Found while testing: the webhook path was behind the CSRF check, which would have rejected every real
  GitHub delivery; it is now exempt and verified by signature only.
- Not covered yet: several repositories per project, GitHub Enterprise hosts beyond `LK_GITHUB_API_URL`,
  comments and labels sync, actions attributed to a system user rather than the person who connected.

## Settings: profile, security, preferences

- Go: `users/service` TestAvatars (type decided from the bytes so SVG and scripts are refused, size limit,
  new address per picture, old file removed on replace, removal, somebody else's picture not served) and
  `auth/service` TestDevices (one row per sign-in even after token rotation, current device marked, signing
  out another person's session looks like a missing one, signed-out sessions cannot refresh, "sign out the
  others" keeps this device).
- Browser: profile (save is off until something changes, validation, header updates, upload / invalid file /
  remove), security (wrong current password, mismatch, second device appears and is signed out, real password
  change and restore), preferences (language, theme), axe on all three.
- Found while testing: a person's signed-in devices pile up (every login is a session for 30 days), so the
  list shows the 50 most recent.
- Not covered yet: changing the email address, deleting the account, linking or unlinking Google/GitHub
  sign-in from the page, two-factor authentication, picture cropping tools beyond the centred square.

## Chat: channel context menu and notification levels

- Go: `chat/service` TestNotifyLevels (default, all three levels round-trip, unknown level refused, outsiders see
  nothing); notifications test updated to the new call.
- Unit: unread count per level, muted channels leave the other sidebar sections, sounds ignore plain messages in
  a mentions-only channel.
- Browser: right-click menu (axe), copy link to clipboard, star/unstar, details dialog, mentions-only, mute and
  hide into the Muted section and back, leave with confirmation.
- Not covered: "Open in split view" from the Slack menu (there is no split view in this app; the menu offers
  *Open in new tab* instead).

## Profile page

- Go: `users/service` TestProfileDetails (trim, partial patch keeps other fields, empty string clears, unknown
  time zone and over-long text refused).
- Browser: profile (name, photo, axe), work details (server validation of the time zone, save, reload keeps values,
  clearing), absence of language/theme controls, redirects from the old `/settings/*` addresses, security tab.
- Not covered: job title is not yet shown on the Team page; changing the email address.
- Until the Settings admin centre ships (next PR) `/settings` redirects to the profile.

## Settings admin centre and custom fields

- Go: `customfields/domain` (value rules per kind, including refusing `javascript:` links and out-of-range numbers),
  `customfields/service` TestFieldsAndValues (admins only define, unique names case-insensitively and reusable after
  delete, select options, order, members fill / viewers read / outsiders see nothing, bad values refused, another
  workspace's field refused, removing an option drops its values, clearing, limit of 30, board lookup limit).
- Unit: value formatting and board chips.
- Browser: settings overview + navigation + axe, rename workspace and restore, delete confirmation needs the typed
  name, labels create / edit / delete, custom fields define (number, choice), duplicate refused, reorder, fill on a
  task, values survive reload, chips on the board, delete.
- Not covered: filter or sort the board by a field; field changes in the activity feed; templates per project;
  a viewer's read-only view in the browser (covered in Go).

## adduser command

- Go: name from the email, `Name <email>` parsing, generated passwords satisfy the platform's own rules and differ every time. Checked by hand against a local database: the new account signs in with the printed password; running again leaves existing accounts alone.
- Passwords are printed once and never stored or logged by the tool.
