# 0016 — Team chat

## Status

Accepted

## Context

Teams need quick conversation next to their tasks and docs, in the same design language.

## Decision

- **Module** `chat` (domain, repository, service, transport, no cross-module imports of domains):
  channels (`public`, `private`, `dm`), members with a read marker, messages, reactions.
- **Access**: callers must belong to the workspace. Public channels can be read by anyone and are
  joined on first post. Private channels and direct messages answer `chat.not_found` to non-members
  so their existence does not leak. Writing needs the editor role; viewers read only.
- **Direct messages** are channels keyed by their sorted participant ids, so a set of people maps to
  one conversation; the member list is fixed.
- **Threads** are one level deep (`parent_id`); the root keeps `reply_count` and `last_reply_at`.
  Deleting a message leaves a tombstone so threads stay intact.
- **Unread**: `last_read_at` per member; unread counts top-level messages from others, mentions
  count replies too. Own messages never count and posting marks the channel read.
- **Reactions** are a closed set of keys mapped to outline icons — the product uses no emoji.
- **Realtime**: the existing Postgres NOTIFY → SSE hints gain `channelId`/`messageId`; clients refetch
  through the authorised REST API. Hints are ids only, so they are safe to fan out per workspace.
- **History** is cursor-paged (`before` = oldest loaded message id), newest page first.
- **UI**: `features/chat`, built only from the shared UI kit and motion presets.

## Consequences

No typing indicators, presence, attachments or search yet; they fit the same hint channel and the
message table (`plain` text search can follow the wiki's approach).

## Addendum: attachments, presence, search

- **Files** are uploaded to a channel first (content type sniffed from the bytes, name sanitised, stored
  through the shared `Storage` port) and bound to a message when it is sent. Unsent uploads are readable
  only by the uploader; a file can only be attached to a message in the same channel by its uploader.
  Downloads follow the channel's access and are served with a sandbox CSP; only known image types are
  shown inline.
- **@channel / @here / @everyone** set `mention_all` on the message; every member's mention count includes it.
- **Presence** is a heartbeat table (seen in the last two minutes = online), polled by clients.
  **Typing** is an ephemeral realtime hint that is never stored.
- **Search** is a case-insensitive substring match over messages of conversations the caller can see
  (public channels and the caller's private channels and DMs), backed by a trigram index.
- **Stars, saved and pins** are small join tables: stars and saved are per person, pins are per channel.
