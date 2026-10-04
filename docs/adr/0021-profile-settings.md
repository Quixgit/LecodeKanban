# ADR 0021: Profile pictures and signed-in devices

Status: accepted

## Context

The Settings → Profile page was an empty placeholder. People need to change their photo and password and see
where they are signed in.

## Decision

- **Pictures** are stored through the same file-storage port as attachments, under an opaque key, with the
  detected type in `users.avatar_type`. The type is decided from the bytes (PNG, JPEG, WebP, GIF only; no
  SVG), never from the upload's name or header. The browser crops the centre square and scales it to 256 px
  before sending, so the server only accepts up to 2 MB. `avatar_url` is `/api/v1/users/{id}/avatar?v=…`: the
  version changes with each picture, so the response is cached for good, and it is served only to signed-in
  users with `nosniff` and a sandbox CSP. A new picture deletes the old file.
- **Devices** are the families of rotated refresh tokens that are still usable (one row per sign-in), listed
  with the last user agent and address seen. The current device is the access token's session id. Signing one
  out revokes its family for that user only (another person's id answers "not found"); "sign out the others"
  keeps the current family. The list is capped at the 50 most recent.
- The user agent is parsed in the browser (a short readable name), not stored in a parsed form.
- Settings are routes under `/settings` (profile, security, preferences); the name and password changes use
  the existing endpoints.

## Consequences

- Pictures live on the attachments volume and are covered by its backups.
- "Last active" is when the sign-in was last renewed (about every 15 minutes while the app is open).
- Email changes and account deletion need a confirmation flow and are left for later.
