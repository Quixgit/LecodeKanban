# ADR 0023: Workspace settings, policies and the audit log

Status: accepted

## Context

Administrators asked to manage the platform from the admin centre: who may invite, who may create projects and
channels, defaults for new tasks, which modules are on, and to see what was changed.

## Decision

- The workspaces module owns a typed `Settings` value per workspace, stored as `jsonb` in `workspace_settings`.
  Keys that were never stored fall back to `Defaults()`, so adding a setting needs no data migration.
- Only settings that **change behaviour** are offered. Each one is enforced on the server by the module that owns the
  action, through `Workspaces.Policy(ctx, ws)` (no extra authorisation: the caller was authorised already):
  invitations (who, lifetime, allowed email domains, never above the inviter's own role), project creation, channel
  creation, `@channel`, default priority and required due date for new tasks.
- Two settings are presentation only, and say so: **modules** (hidden from the menu and their pages show "switched
  off"; data is kept and the API is not blocked) and the **calendar week start**.
- Changes go through one `PATCH` that validates every field and writes only when something changed. Each real change,
  and role changes, member removals and invitations, is added to `workspace_audit` (best effort for the secondary
  actions, in the same transaction for settings). The log is visible to administrators.
- The admin centre saves each control at once (with an optimistic update and a "Saved" toast) instead of one big form,
  so a setting never silently stays unsaved.

## Consequences

- Turning a module off is not a security boundary. A true module switch (API refusal, scheduler, search) is future work.
- The audit log covers workspace administration only; card, project and chat history live in their own modules.
