# ADR 0022: Custom fields and the Settings admin centre

Status: accepted

## Context

Teams track different things on a task (budget, story points, risk, customer). We want administrators to add such
fields without a code change, and a Settings area that is the platform's admin centre, separate from the person's
own profile (ADR 0021).

## Decision

- A new module `customfields` owns **definitions** (per workspace: name, kind, options, order, whether it shows on the
  board card) and **values** (per card and field, stored as `jsonb`). Kinds: text, number, date, choice, checkbox,
  link. The kind cannot change after creation, so stored values always match it.
- Values are validated and normalised by the field (`Field.Normalize`): a link must be http(s), a date `YYYY-MM-DD`,
  a choice must be one of the options, an empty value clears. Removing a choice deletes the values that used it.
- Permissions follow existing rules: workspace administrators define fields (`workspace.update`); everyone in the
  workspace can read them; whoever can edit a card (`content.edit`) sets its values. A field of another workspace
  is "not found" through a card, and outsiders never learn that a field exists.
- Limits: 30 fields per workspace, 50 choices per field, 500 cards per board lookup.
- The board loads values for the visible cards in one request (`POST …/custom-fields/values`), not one per card.
- Deleting a field is a soft delete (`archived_at`) so the unique name can be reused; its values are no longer read.
- Settings is a shell with grouped sections (General, Custom fields, Labels; Members and Integrations link to their
  own pages). Non-administrators can look but not change.

## Consequences

- Filtering and sorting the board by a custom field, activity-feed entries for field changes, and field templates per
  project are not included yet.
