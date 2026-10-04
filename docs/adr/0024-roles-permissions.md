# ADR 0024: Detailed permissions and custom roles

Status: accepted

## Context

Four fixed roles and a few "who can…" switches were not enough: administrators wanted to choose exactly what each
role may do, keep the defaults, or build their own roles.

## Decision

- A **permission catalog** (`workspaces/domain/permissions.go`) lists every action (view, edit tasks, delete tasks,
  moderate, create/edit/delete projects, boards, labels, custom fields, channels, `@channel`, chat moderation, time,
  integrations, invite, manage members, workspace settings, audit, roles, delete workspace). Each built-in role has a
  default set (`RoleDefaults`).
- Authorisation returns an `Access` value (rank + effective permission set); modules ask `access.Can(perm)` instead of
  comparing roles. The old "who can invite / create projects / create channels / @channel" settings are replaced by
  permissions.
- A workspace can **override** the permission set of the Member, Viewer and Admin roles (`workspace_role_overrides`;
  "reset to defaults" deletes the override) and define up to 20 **custom roles** (`workspace_roles`: name,
  description, base role, permission set). A member holds one built-in role (rank) and optionally one custom role
  (`workspace_members.custom_role_id`); a custom role keeps the rank of its base, so rank rules (who may promote,
  demote or remove whom) still hold.
- Fixed rules: the Owner always holds every permission; "see the workspace" is always on; owner-only permissions
  (delete workspace, manage roles) cannot be given to other roles. Nobody can grant a permission they lack
  (escalation guard) or invite above their own rank. Only users with `roles.manage` edit roles.
- Every change is written to the audit log. The client mirrors the server with `can(workspace, perm)`, only to show
  or hide controls.

## Consequences

- Adding an action means adding a catalog entry (+ en/uk texts) and one `Can` check in the owning module.
- A custom role cannot exceed its base role's rank-based powers (promotion, removal); fine-grained permissions only.
