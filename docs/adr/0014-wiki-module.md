# 0014 — Wiki ("Docs") module: spaces, tree, visibility and authorization

- Status: accepted
- Date: 2026-10-03

## Context

The team needs a knowledge base next to the Kanban board. Phase W1 delivers the backend core:
spaces, a tree of folders and pages, per-element visibility and grants, trash, favorites and an
audit log. Page content, the editor, collaboration, search, comments and public links come in later
phases and attach to `wiki_nodes`.

## Decisions

**Structure.** A _space_ is a top-level container; a _node_ is a folder or a page and either can have
children. Nodes carry a materialised `path` (`/<id>/<id>/…/`) so subtree moves, depth checks and
trash are single `LIKE prefix%` statements, plus `depth` and a fractional `rank` per parent
(`platform/fractional`, one row written per reorder). The default depth limit is 12 and is
configurable per space (2–32); a move checks the _whole subtree's_ depth, lowering the limit below
existing nesting is refused.

**Visibility** is `private`, `shared` or `workspace` (everybody in the workspace, with a configurable
`viewer | commenter | editor` ability). A space is always explicit; a node is explicit or _inherits_
(`NULL`). The public-link level is added in W5.

**Resolution rules** (`domain.Resolve`, the only place access is decided, table-tested):

1. Effective visibility = the nearest explicit one walking up from the node.
2. Explicit access = the closest element (node first, then ancestors) where the user is the _owner_
   (`owner_id`) or has a grant, directly or through a team. It overrides everything above it, in both
   directions (a node grant can lower or raise what the space gives).
3. Otherwise `workspace` visibility gives every member the element's workspace ability.
4. A **private element is an access boundary**: grants and ownership of ancestors do not reach into
   it. `shared` and `workspace` elements keep ancestors' grants (a `shared` child drops the workspace
   audience but keeps the space's guests).
5. Non-members never get anything; workspace _viewers_ are capped to read everywhere.

Capabilities: view ≥ viewer, comment ≥ commenter, edit ≥ editor (content, create, rename, move,
soft-delete), manage = owner (share, visibility, permanent delete, space settings).

**Workspace admins have no special access to private content.** Admins and owners of the workspace
get the same treatment as any member: a private page or space is invisible to them until they are
invited. The tree never contains placeholders for hidden nodes — existence is not leaked; endpoints
answer `wiki.not_found` (never `forbidden`) when the caller has no access at all, and `forbidden`
only when they can see the element but lack the role. Consequence: if a person leaves, their private
pages are unreachable; an explicit admin takeover flow is deferred until it is needed.

**Detached nodes.** A node the caller may see under a parent they may not appears in the tree
response with `detached: true` and `parentId: null`; clients list it under "Shared with me".

**Moving** needs edit rights on the node and the destination, rejects cycles and depth overflow, and
compares the node's _audience_ before and after (`AudienceOf` / `WidensComparedTo`: visibility level,
workspace ability, and every owner/grantee reaching it). If it grows, the API answers
`409 wiki.confirm_widening` and the client repeats with `confirmWiden`. Node-level grants and
descendants follow a node into another space.

**Trash.** Delete sets `deleted_at` and `trash_root_id` on the whole subtree; only trash roots are
listed/restorable, for 30 days (a maintenance job purges later, expired entries are hidden at once).
Restore returns the subtree to its place, or to the space root when its parent is trashed or purged;
a relocated node that inherited its visibility gets that effective visibility written explicitly, so
restoring never silently widens access. `parent_id` is `ON DELETE SET NULL` so purging a parent keeps
independently trashed children restorable. Before any purge (manual or by the expiry job) such
survivors that still inherit their visibility get the effective one written explicitly, so a purge
never turns a private page into a workspace-visible one. The 30-day window is also enforced on
restore itself, not only by the cleanup job.

**Teams.** Grants support `principal_kind = team` and the Authorizer resolves team membership through
the `Teams` port, but the product has no teams yet: `cmd/server/wire.go` wires an adapter that answers
"no teams", and granting to a team is rejected as an unknown principal. Replace the adapter when a
teams module exists; no schema change is needed.

**Audit.** `wiki_audit` is append-only (no FK to nodes, so entries outlive purged pages) and records
space/node create, rename, move, delete, restore, purge, visibility and every grant change. Owners read
it per space.

## Consequences

- Access is computed in memory per request (two queries per space for lists and the tree, one chain
  load for single-node operations); fine to several thousand nodes per space, revisit with caching if
  trees grow far beyond that.
- "Shared with me" lists nodes with direct grants only; pages opened through visibility are found in
  their space.
- Realtime events for tree changes, search, content, comments and public links are not part of W1.
