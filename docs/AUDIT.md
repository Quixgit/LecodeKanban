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

## Profile v2 and teammate card

- Go: `users/service` TestProfileExtrasAndCover (address normalisation, refusals for foreign LinkedIn hosts, short
  Telegram names, `javascript:` websites, reversed hours, too many skills, unknown preset; partial patches keep
  fields; cover upload accepts only real pictures, size limit, a preset replaces the upload and removes the file),
  `workspaces/service` TestMemberProfile (members see each other; outsiders and non-members get nothing).
- Unit: local time and working-hours maths in other time zones.
- Browser: background preset / upload / reset, links and skills saved and tidied, server refusal shown, another
  person's card from the Team page (axe), message button opens the DM, card from a chat message and from the channel
  member list.
- Privacy: email and phone are visible to everyone in the workspace (as in most team tools); there is no per-field
  visibility switch yet.
- Not covered: an @mention opens the card (wired, but not exercised in the browser).
## adduser command

- Go: name from the email, `Name <email>` parsing, generated passwords satisfy the platform's own rules and differ every time. Checked by hand against a local database: the new account signs in with the printed password; running again leaves existing accounts alone.
- Passwords are printed once and never stored or logged by the tool.
## Dashboard trends

- Go: `trend` (no baseline gives null, +50%, -75%), stats follow the requested period. Unit: MetricCard shows the
  fallback and never +0.00%. Browser: checked by screenshot on the demo data (+164.00% for new tasks).

## Workspace settings, policies and audit log

- Go: `workspaces/service` TestSettingsAndPolicies (defaults for everyone, only admins change, bad values refused,
  members cannot invite until allowed, never above their own role, allowed domains, invitation lifetime, unchanged patch
  writes nothing, audit lists who and what, audit is admin-only); `projects` / `chat` / `cards` policy tests (project
  and channel creation limited to admins, @channel limited, default priority and required due date).
- Browser: overview and navigation (axe), modules off/on (menu entry gone, page gated), access settings persisted and
  shown after reload (axe), week start Sunday in the calendar, audit entries with the actor, settings put back.
- Not covered: switching a module off does not block its API (documented in ADR 0023); no data export yet;
  time format and date format preferences are not offered because they would not apply everywhere.
- Migrations 00026 (profile) and 00027 (settings) must both be applied; apply them in order.

## Email delivery page

- Go: `workspaces/service` TestMailStatusAndTestMail (only emails to the workspace's people are listed, newest first with
  their error; counts; admins only; test mail goes to the admin only; Mailpit/localhost is flagged as a test inbox, real
  providers are not; the invitation link is returned on creation).
- Browser: the page (axe), the test-inbox warning, a test email appears in the list, the invitation link in the invite
  dialog.
- The page cannot change the mail settings: credentials stay in `.env` by design.
## Dashboard trend chips, chat menu, header and split view

- Go: temporary mute round-trips, shows its end, is refused for a past time or a level other than muted, lifts to
  "all". Unit: MetricCard (percentage, absolute delta, flat zero), mute end times (hour, tomorrow 9:00, next Monday).
- Browser: menu (axe) with details / copy / star / inline notification levels / temporary mute / mute and hide / split
  view / leave; member list on the new Members tab.
- Not covered: "Edit default preferences" from the Slack menu (we have no per-user notification defaults page yet).

## Roles and permissions

- Go: permission catalog, defaults, `Access`, `Clean`; role overrides, custom roles (create / update / delete / assign,
  name clash, limit, locked owner), escalation guard, invitations by permission, enforcement in projects, chat, time,
  attachments, comments, cards, labels, boards, custom fields, GitHub, audit.
- Unit: `can()`, invitable roles. Browser: Settings → Roles (axe, toggle + reset, create + delete a custom role).
- Not covered: a module-level permission test in the browser for every action (covered by Go authz tests).

## Workspace look and more rules

- Go: look values validated (colour, icon, edit window), defaults for what was never stored; require-assignee,
  direct messages (own notes still allowed), files, edit window, manual time are refused by the owning module.
- Browser: pick icon and accent (style injected, survives reload, axe), switch direct messages off (button gone) and
  back, restore the look.
- Not covered: "require two-step verification" for everyone (needs the 2FA PR and a gate on authorisation).

## Docs defaults

- Go: workspace defaults apply to new spaces; an explicit choice wins; depth below 2 refused.
- Browser: set and persist the default visibility.
## Two-step verification

- Go: TOTP against RFC 6238 vectors; scoped tokens are not access tokens; full life cycle (setup, wrong/right code,
  replayed code refused, recovery code once, regenerate, disable needs password + code), lock-out after repeated wrong codes.
- Unit: login form asks for the code. Browser: register, turn on (axe on the dialog), wrong code, sign in with a code,
  with a recovery code, turn off.
- Not covered: admin policy to require 2FA; reset when both phone and recovery codes are lost.
## UI polish

- Unit: existing MetricCard/overlay tests; browser: settings, kanban, task window suites pass with the new fields and close button.
- Not covered: visual regression of the mint outline (checked by eye).

## Integration pages

- Browser (with the stand-ins): Google Calendar and GitHub flows now run on the module pages (connect, settings,
  pause, disconnect), axe on the page.

## Icon-rail menu

- Browser: switch on, section menu (settings, tasks with counts), a section without a menu closes the column, axe on the
  rail, choice survives a reload, switch back.
- Not covered: the rail below the lg breakpoint (the mobile drawer is unchanged).

## Chat appearance

- Unit: theme maths (default untouched, light text on dark / dark on light, AA for accents and muted text on every preset).
- Browser: pick a theme (axe on the themed sidebar and chat), reload keeps it, own colour, reset.

## Export tasks

- Go: export needs the permission (members refused, owner allowed, grantable to members); formula cells neutralised.
- Browser: the page offers the download (axe) and the file has the header row and data rows.
- Not covered: export of other data (comments, time entries, docs) and a truncation notice in the UI.
## Rail: chat and docs lists

- Browser: in the rail layout the channel list is inside the rail and not in the page; the docs tree too; axe on the rail.
- Not covered: the rail below the lg breakpoint (the mobile layout is unchanged).
## Admin overview

- Unit: set-up steps and progress (unknown steps are neither done nor open). Browser: settings suite.
- Not covered: the checklist has no step for integrations (it would make settings depend on the integrations module).

## Require two-step verification

- Go: setting refused for an owner without 2FA; members without it blocked in `Authorize` and marked in the list;
  turning it on opens the door; turning the requirement off lets everyone in.
- Browser: owner enables 2FA, requires it, turns their own off and sees the gate with the way to the security page.
- Cost: one small indexed query per authorised request (the flag in the settings row).
## Filter and sort by custom field

- Go: filter by equality and by text search; sort ascending and descending with numbers as numbers and cards without a value last.
- Browser: choose a field and a value in the board's filter and only the matching task stays.
- Not covered: sorting the board by a field (the board keeps its manual order), several field filters at once.
## Notification preferences

- Go: all kinds on by default; unknown kind refused; a switched-off kind is not delivered while others are; switching on restores it.
- Browser: toggle persists across reload (axe).
- Not covered: per-channel/per-project overrides and email notifications (the product sends none of those kinds by email).
## CSV import

- Go: parser (BOM, `;` separator, uk/en headers, status/priority/date aliases, blank lines, export formula guard undone, missing title column, empty file); service (dry run writes nothing, per-row warnings for unknown people/labels, rows without title skipped, status/assignee applied, viewer refused).
- Browser: Data page checks a file, lists the skipped line, imports, the task shows on the board (axe on the preview).
- Not covered: creating missing labels/people (they are reported and left empty), updating existing tasks by key, the 2000-row/2 MB limits end to end, docs and chat export (documents already export per page; chat export is a separate step).

## Trash

- Go: trash lists the parent (not its subtask), newest first; subtask restore is refused while the parent is trashed;
  restoring a parent brings the subtask; viewers are refused; a restored task is live again.
- Browser: delete a task, find it in the trash (axe), restore it, see it in the task list.
- Not covered: deleting forever (the trash is not emptied; attachment files would need cleaning with it).
## Interface: shortcuts, density, phone menu

- Unit: accent tokens pass AA (light and dark) for every offered accent and for extremes (yellow, white, black…).
- Browser: `?` dialog (axe) and g-then-letter jumps; density persists across reload; the icon menu on a phone (axe); 2FA
  flow now runs in the dark theme (axe on the dialog).
