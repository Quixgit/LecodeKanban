# ADR 0020: GitHub integration

Status: accepted

## Context

Teams keep pull requests and issues on GitHub and tasks here. They want the two to follow each other: a
merged pull request should finish its task, a task moved to Done should close its issue, and a new issue
should not have to be retyped.

## Decision

- A `github` module owns a **workspace-level** connection (not per person): an access token pasted by an
  owner or administrator and sealed with the encryption key, plus a per-workspace webhook secret. A token
  was chosen over a GitHub OAuth app because OAuth apps allow one callback URL (taken by sign-in) and need
  extra server configuration; a token needs none.
- Projects are linked to repositories (one repository per project). Linking registers a webhook on the
  repository; unlinking or disconnecting removes it.
- **Inbound** (`POST /api/v1/integrations/github/webhook`): public and exempt from the CSRF check (GitHub
  sends no cookies); the HMAC-SHA256 signature of the body, computed with the secret of the workspace that
  owns the repository named in the payload, is the credential. Deliveries are de-duplicated by id. Task
  keys (`PLT-12`) are read from pull request titles, branch names and bodies and resolved through the
  cards module (`FindByKey`). Rules (switches) decide what opened/merged pull requests and issue events do.
- **Outbound**: a subscriber on `CardMoved` closes/reopens linked issues and comments on open pull
  requests, off the request path with a detached context. Moves that came *from* GitHub carry a context
  marker, so a merge is not echoed back as a comment or a close.
- Issues the app creates carry a hidden marker with the card id, so their own `opened` webhook links
  instead of creating a duplicate card.
- Changes made by rules are executed as the person who connected GitHub (the cards module needs an actor).
- The module reaches cards through a port, the GitHub API through a small client, and never reads other
  modules' tables.

## Consequences

- The webhook only works when `LK_PUBLIC_URL` is reachable from GitHub.
- Attribution of rule-made changes to the connecting person is an approximation; a system actor would be
  cleaner and can replace it later.
- Tokens are long-lived; a rejected token surfaces as a clear error and the person reconnects.
