# ADR 0025: Two-step verification (TOTP)

Status: accepted

## Context

Accounts were protected by a password alone. People asked to be able to turn on (and off) a second factor.

## Decision

- Standard TOTP (RFC 6238: HMAC-SHA1, 6 digits, 30 s) so any authenticator app works. `platform/totp` has no
  dependencies and is tested against the RFC vectors.
- `user_two_factor` stores the secret **sealed** (AES-GCM, bound to the user id), whether it is on, the last accepted
  30-second step (a code works once; a replay is refused) and the SHA-256 of unused recovery codes (8, one-time).
- Turning on is two steps: setup returns a secret and an `otpauth://` address (shown as a QR code in the browser);
  nothing changes until a first code is confirmed, which also returns the recovery codes (shown once).
- Sign-in: a correct password for an account with the factor on answers `401 auth.two_factor_required` with a signed,
  5-minute, scoped token (`meta.token`; a different audience, so it can never act as an access token). The client then
  calls `POST /auth/login/two-factor` with the token and a code (or a recovery code). Wrong codes count as failed
  sign-ins and lock the account like wrong passwords.
- Turning off needs the current password (when there is one) and a valid code. New recovery codes need a valid code.
- OAuth sign-in (Google/GitHub) is refused for accounts with the factor on (the provider cannot answer our code);
  they sign in with email and password and a code.

## Consequences

- Admin policy ("require two-step for everyone") is not part of this change.
- Losing both the phone and the recovery codes needs an administrator with database access; there is no email reset.
