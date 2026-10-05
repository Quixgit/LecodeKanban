# 0005 — Authentication, sessions and CSRF

- Status: accepted
- Date: 2026-10-01

## Decision

- **Passwords:** argon2id (m=64 MiB, t=3, p=2, PHC string), transparent rehash on login when
  parameters are raised. Policy: 10–128 chars, ≥3 Unicode character classes (lower/upper/digit/other),
  enforced identically on server and client.
- **Access token:** HS256 JWT, 15 min (`LK_ACCESS_TTL`), in httpOnly `lk_at` cookie
  (`Path=/api`, `SameSite=Lax`). Claims: `sub` user, `sid` session family. `alg=none` and foreign
  keys are rejected.
- **Refresh token:** 256-bit opaque value, stored only as SHA-256, httpOnly `lk_rt` cookie
  (`Path=/api/v1/auth`, `SameSite=Strict`), 30 days. **Rotated on every use**. Tokens of one login
  form a _family_; presenting an already-rotated token revokes the family (theft detection), except
  within a 15 s grace window, which covers two tabs refreshing simultaneously (the second gets an
  access token only; the browser already holds the new refresh cookie).
- **CSRF:** double-submit cookie `lk_csrf` (readable by the SPA) echoed in `X-CSRF-Token` for every
  non-GET request, plus an `Origin` allowlist check. Rotated on sign-in, not on refresh.
- **Lockout:** 5 consecutive failures lock the account for 15 min (`423 auth.account_locked` with
  `retryAfter`); per-IP rate limits on login/register/email endpoints; unknown emails run a dummy
  argon2 verification to keep timing uniform.
- **Email verification / password reset:** single-use hashed tokens (48 h / 1 h), emailed through the
  job queue. Reset revokes every session and marks the email verified. Forgot-password always
  answers 204 (no account enumeration). Unverified users can sign in and see a banner.
- **OAuth (Google, GitHub):** authorization code + PKCE (S256), state and verifier in a short-lived
  HMAC-signed cookie, identity-only scopes. Identities link to an existing account **only** when the
  provider reports the email as verified; otherwise sign-in is refused (account-takeover guard).
  `next` redirects accept same-origin relative paths only.

## Consequences

- With `LK_COOKIE_SECURE=false` (plain HTTP on the bare IP, ADR 0004) cookies are not `Secure`;
  production behind TLS must set it to `true` (the default).
- Google rejects raw-IP redirect URIs, so Google sign-in needs a hostname (or localhost) in
  `LK_PUBLIC_URL`; GitHub accepts the IP. Buttons for unconfigured providers render disabled.
