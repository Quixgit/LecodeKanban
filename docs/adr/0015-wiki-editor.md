# 0015 — Wiki editor and page content

## Status

Accepted

## Context

Docs pages need rich editing, Markdown, safe storage and autosave, without coupling the editor to
the rest of the wiki UI.

## Decision

- **Editor**: TipTap (ProseMirror) in `features/wiki-editor`, loaded lazily; the wiki feature only
  imports `PageEditor`. Markdown is a first-class format (`@tiptap/markdown`, GitHub-style callouts,
  Mermaid as a code-block language).
- **Storage**: content is ProseMirror JSON in `wiki_contents` with an optimistic `version` and a
  derived `plain` text column (search in W5). Saves with a stale version return 409
  `wiki.content_conflict`; the client stops autosaving and offers a reload.
- **Validation**: the server never trusts the client. `domain.ValidateDoc` allow-lists nodes, marks
  and attributes, refuses `javascript:`/`data:`/protocol-relative links, non-https images and
  non-YouTube videos, and caps the size. `sanitizeDoc` mirrors it on the client; a test keeps the
  editor schema and the allow-list in sync.
- **Files**: uploads sniff the content type, are stored through the `Storage` port and served with a
  sandboxing CSP; access follows the owning page.
- **Autosave**: 900 ms debounce, 6 s max wait, one request in flight, retry while offline.

## Consequences

Adding an editor extension requires a matching allow-list entry (the sync test fails otherwise).
Orphaned files need a cleanup job later.
