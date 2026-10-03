# 0017 — Email delivery through Mailgun

## Status

Accepted

## Context

Invitations and the "confirm your email" message are queued as `mail.send` jobs and were delivered
over SMTP. In production the relay was Mailpit, a catch-all inbox for development, so real people
never received anything.

## Decision

- Keep the job queue (retries, idempotency keys) and add a second sender behind the same
  `mailer.Sender` interface: `MailgunSender`, selected with `LK_MAIL_PROVIDER=mailgun`.
- It posts to the Mailgun HTTP API (`/v3/<domain>/messages`, basic auth `api:<key>`), so it works
  from hosts that block outbound SMTP. Region `us` or `eu` picks the API host.
- Errors are classified for the queue: 4xx (bad key, unverified domain, invalid recipient) are
  permanent; 429, 5xx and network failures are retried. The API key never appears in errors or logs.
- `LK_MAIL_PROVIDER=smtp` stays the default, so development with Mailpit is unchanged. Mailgun's
  SMTP relay also works with the existing `LK_SMTP_*` settings if the HTTP API is not wanted.
- Configuration is validated at start: Mailgun needs the API key and domain.

## Operations

1. In Mailgun add the sending domain (e.g. `mg.example.com`) and publish the SPF, DKIM and (for
   deliverability) DMARC records it shows; wait until the domain is verified.
2. Set in the server `.env`: `LK_MAIL_PROVIDER=mailgun`, `LK_MAILGUN_API_KEY`, `LK_MAILGUN_DOMAIN`,
   `LK_MAILGUN_REGION`, and `LK_MAILGUN_FROM="LecodeKanban <no-reply@mg.example.com>"`.
3. `make deploy`. Sandbox domains only deliver to recipients authorised in Mailgun.

## Consequences

Delivery depends on a third party and on DNS being set up; failures show in the job queue and the
Mailgun logs. Bounce and complaint webhooks are not handled yet.
