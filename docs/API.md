# LecodeKanban API — v0.3.0

> Generated from `api/openapi.yaml` by `make gen`. Do not edit by hand.

REST API of LecodeKanban. Source of truth for Go DTOs and the TypeScript client (`make gen`).

**Auth:** httpOnly cookies — `lk_at` (access, ~15 min) and `lk_rt` (rotating refresh,
path-scoped to `/api/v1/auth`). **CSRF:** every non-GET request must echo the `lk_csrf`
cookie in the `X-CSRF-Token` header (obtain it via `GET /auth/csrf`).

**Errors** are `{"error": {"code", "message", "fields"?, "meta"?}}`. `code` is stable and
translated by clients; `message` is an English developer hint. See `GET /i18n/error-codes`.

Base URL: `/api/v1`

## auth

| Method | Path                              | Auth    | Request               | Responses                                               | Summary                                                                        |
| ------ | --------------------------------- | ------- | --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/auth/csrf`                      | public  |                       | 200                                                     | Issue the CSRF cookie                                                          |
| GET    | `/auth/providers`                 | public  |                       | 200                                                     | Which OAuth providers are configured                                           |
| POST   | `/auth/register`                  | public  | RegisterRequest       | 201 Session, 409 Error, 422 Error, 429 Error            |                                                                                |
| POST   | `/auth/login`                     | public  | LoginRequest          | 200 Session, 401 Error, 423 Error, 429 Error            |                                                                                |
| POST   | `/auth/refresh`                   | public  |                       | 200 Session, 401 Error                                  | Rotate the refresh token and issue a new access token                          |
| POST   | `/auth/logout`                    | public  |                       | 204                                                     |                                                                                |
| GET    | `/auth/session`                   | session |                       | 200 Session, 401 Error                                  |                                                                                |
| POST   | `/auth/verify-email`              | public  | TokenRequest          | 204, 400 Error                                          |                                                                                |
| POST   | `/auth/verify-email/resend`       | session |                       | 204, 429 Error                                          |                                                                                |
| POST   | `/auth/password/forgot`           | public  | EmailRequest          | 204, 429 Error                                          |                                                                                |
| POST   | `/auth/password/reset`            | public  | ResetPasswordRequest  | 204, 400 Error, 422 Error                               |                                                                                |
| GET    | `/auth/oauth/{provider}/start`    | public  |                       | 302, 404 Error                                          |                                                                                |
| GET    | `/auth/oauth/{provider}/callback` | public  |                       | 302                                                     |                                                                                |
| POST   | `/auth/login/two-factor`          | public  | TwoFactorLoginRequest | 200 Session, 401 Error, 422 Error, 423 Error, 429 Error | Finish a sign-in with the code from the authenticator app (or a recovery code) |

## users

| Method | Path                                  | Auth    | Request                 | Responses                 | Summary                                                              |
| ------ | ------------------------------------- | ------- | ----------------------- | ------------------------- | -------------------------------------------------------------------- |
| GET    | `/users/me`                           | session |                         | 200                       |                                                                      |
| PATCH  | `/users/me`                           | session | UpdateProfileRequest    | 200, 422 Error            |                                                                      |
| POST   | `/users/me/onboarding/complete`       | session |                         | 200                       | Mark the welcome wizard as finished or skipped                       |
| POST   | `/users/me/avatar`                    | session |                         | 200, 413 Error, 422 Error | Upload a profile picture (PNG, JPEG, WebP or GIF, up to 2 MB)        |
| DELETE | `/users/me/avatar`                    | session |                         | 200                       | Remove the profile picture                                           |
| GET    | `/users/{userId}/avatar`              | session |                         | 200, 404 Error            | A user's uploaded profile picture (signed-in users only)             |
| POST   | `/users/me/cover`                     | session |                         | 200, 413 Error, 422 Error | Upload a profile background (PNG, JPEG, WebP or GIF, up to 5 MB)     |
| DELETE | `/users/me/cover`                     | session |                         | 200                       | Remove the uploaded profile background                               |
| GET    | `/users/{userId}/cover`               | session |                         | 200, 404 Error            | A user's uploaded profile background (signed-in users only)          |
| GET    | `/users/me/sessions`                  | session |                         | 200                       | Where the caller is signed in                                        |
| POST   | `/users/me/sessions/revoke-others`    | session |                         | 204                       | Sign out everywhere except this device                               |
| DELETE | `/users/me/sessions/{sessionId}`      | session |                         | 204, 404 Error            | Sign one device out                                                  |
| GET    | `/users/me/two-factor`                | session |                         | 200                       |                                                                      |
| POST   | `/users/me/two-factor/setup`          | session |                         | 200, 409 Error            | Generate a secret to scan; nothing changes until a code is confirmed |
| POST   | `/users/me/two-factor/enable`         | session | CodeRequest             | 200, 409 Error, 422 Error |                                                                      |
| POST   | `/users/me/two-factor/disable`        | session | TwoFactorDisableRequest | 204, 409 Error, 422 Error |                                                                      |
| POST   | `/users/me/two-factor/recovery-codes` | session | CodeRequest             | 200, 422 Error            | Replace the recovery codes (needs a valid code)                      |
| POST   | `/users/me/password`                  | session | ChangePasswordRequest   | 204, 401 Error, 422 Error |                                                                      |

## notifications

| Method | Path                                           | Auth    | Request                | Responses      | Summary                                                                          |
| ------ | ---------------------------------------------- | ------- | ---------------------- | -------------- | -------------------------------------------------------------------------------- |
| GET    | `/users/me/notification-prefs`                 | session |                        | 200            | Which kinds of notification the caller wants (all on unless switched off)        |
| PUT    | `/users/me/notification-prefs`                 | session | NotificationPrefInput  | 204, 422 Error |                                                                                  |
| GET    | `/workspaces/{workspaceId}/notifications`      | session |                        | 200            | The caller's notifications in the workspace, newest first, with the unread count |
| POST   | `/workspaces/{workspaceId}/notifications/read` | session | NotificationsReadInput | 204            | Mark the given notifications (or all of them) as read                            |

## workspaces

| Method | Path                                                     | Auth    | Request                | Responses                 | Summary                                                                                                    |
| ------ | -------------------------------------------------------- | ------- | ---------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/workspaces`                                            | session |                        | 200                       | Workspaces the caller belongs to (a personal one is created on first call if none)                         |
| POST   | `/workspaces`                                            | session | WorkspaceInput         | 201, 422 Error            |                                                                                                            |
| GET    | `/workspaces/{workspaceId}`                              | session |                        | 200, 404 Error            |                                                                                                            |
| PATCH  | `/workspaces/{workspaceId}`                              | session | WorkspaceInput         | 200, 403 Error            |                                                                                                            |
| DELETE | `/workspaces/{workspaceId}`                              | session |                        | 204, 403 Error            |                                                                                                            |
| GET    | `/workspaces/{workspaceId}/settings`                     | session |                        | 200                       | The workspace's rules and feature switches (any member)                                                    |
| PATCH  | `/workspaces/{workspaceId}/settings`                     | session | WorkspaceSettingsPatch | 200, 403 Error, 422 Error | Change settings (administrators); changes are written to the audit log                                     |
| GET    | `/workspaces/{workspaceId}/audit`                        | session |                        | 200                       | The latest administrator actions (administrators)                                                          |
| GET    | `/workspaces/{workspaceId}/roles`                        | session |                        | 200                       | The permission catalog and every role of the workspace (any member)                                        |
| POST   | `/workspaces/{workspaceId}/roles`                        | session | RoleInput              | 201, 409 Error, 422 Error | Define a custom role (people who may manage roles)                                                         |
| PUT    | `/workspaces/{workspaceId}/roles/{roleKey}`              | session | PermissionsInput       | 204, 403 Error, 422 Error | Change what a built-in role (admin, member, viewer) may do in this workspace                               |
| PATCH  | `/workspaces/{workspaceId}/roles/{roleKey}`              | session | RoleInput              | 200, 409 Error            | Change a custom role                                                                                       |
| DELETE | `/workspaces/{workspaceId}/roles/{roleKey}`              | session |                        | 204                       | Delete a custom role; its people go back to the built-in role it ranked as                                 |
| POST   | `/workspaces/{workspaceId}/roles/{roleKey}/reset`        | session |                        | 204                       | Put a built-in role back to its default permissions                                                        |
| PUT    | `/workspaces/{workspaceId}/members/{userId}/custom-role` | session |                        | 204, 403 Error            | Give a member a custom role, or null to go back to their built-in role                                     |
| GET    | `/workspaces/{workspaceId}/mail`                         | session |                        | 200                       | How email leaves this server, the queue, and the latest emails to this workspace's people (administrators) |
| POST   | `/workspaces/{workspaceId}/mail/test`                    | session |                        | 202                       | Send a test email to the caller (administrators)                                                           |
| GET    | `/workspaces/{workspaceId}/members`                      | session |                        | 200                       |                                                                                                            |
| GET    | `/workspaces/{workspaceId}/members/{userId}`             | session |                        | 200, 404 Error            | A teammate's profile card                                                                                  |
| PATCH  | `/workspaces/{workspaceId}/members/{userId}`             | session | UpdateMemberRequest    | 204, 403 Error, 409 Error |                                                                                                            |
| DELETE | `/workspaces/{workspaceId}/members/{userId}`             | session |                        | 204, 403 Error, 409 Error | Remove a member (or leave, when userId is the caller)                                                      |
| GET    | `/workspaces/{workspaceId}/invites`                      | session |                        | 200                       |                                                                                                            |
| POST   | `/workspaces/{workspaceId}/invites`                      | session | CreateInviteRequest    | 201, 403 Error, 409 Error |                                                                                                            |
| DELETE | `/workspaces/{workspaceId}/invites/{inviteId}`           | session |                        | 204, 404 Error            |                                                                                                            |
| GET    | `/invites/{token}`                                       | public  |                        | 200, 404 Error            |                                                                                                            |
| POST   | `/invites/{token}/accept`                                | session |                        | 200, 403 Error, 410 Error |                                                                                                            |
| GET    | `/meta`                                                  | session |                        | 200                       | Which build is running and on what                                                                         |

## projects

| Method | Path                                         | Auth    | Request      | Responses                 | Summary |
| ------ | -------------------------------------------- | ------- | ------------ | ------------------------- | ------- |
| GET    | `/workspaces/{workspaceId}/projects`         | session |              | 200                       |         |
| POST   | `/workspaces/{workspaceId}/projects`         | session | ProjectInput | 201, 409 Error, 422 Error |         |
| GET    | `/workspaces/{workspaceId}/projects/summary` | session |              | 200                       |         |
| GET    | `/projects/{projectId}`                      | session |              | 200, 404 Error            |         |
| PATCH  | `/projects/{projectId}`                      | session | ProjectPatch | 200, 403 Error            |         |
| DELETE | `/projects/{projectId}`                      | session |              | 204, 403 Error            |         |

## boards

| Method | Path                                  | Auth    | Request        | Responses                 | Summary |
| ------ | ------------------------------------- | ------- | -------------- | ------------------------- | ------- |
| GET    | `/projects/{projectId}/board`         | session |                | 200                       |         |
| POST   | `/projects/{projectId}/board/columns` | session | ColumnInput    | 201, 422 Error            |         |
| PATCH  | `/columns/{columnId}`                 | session | ColumnPatch    | 200, 422 Error            |         |
| DELETE | `/columns/{columnId}`                 | session |                | 204, 409 Error, 422 Error |         |
| POST   | `/columns/{columnId}/move`            | session | Neighbours     | 200                       |         |
| GET    | `/workspaces/{workspaceId}/views`     | session |                | 200                       |         |
| POST   | `/workspaces/{workspaceId}/views`     | session | SavedViewInput | 201, 422 Error            |         |
| PATCH  | `/views/{viewId}`                     | session | SavedViewPatch | 200                       |         |
| DELETE | `/views/{viewId}`                     | session |                | 204                       |         |

## cards

| Method | Path                                              | Auth    | Request            | Responses                 | Summary                                                                            |
| ------ | ------------------------------------------------- | ------- | ------------------ | ------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/cards`                 | session |                    | 200                       |                                                                                    |
| POST   | `/workspaces/{workspaceId}/cards`                 | session | CardInput          | 201, 422 Error            |                                                                                    |
| GET    | `/workspaces/{workspaceId}/cards/summary`         | session |                    | 200                       |                                                                                    |
| POST   | `/workspaces/{workspaceId}/cards/bulk`            | session | BulkCardAction     | 200                       |                                                                                    |
| GET    | `/workspaces/{workspaceId}/cards/stats`           | session |                    | 200                       |                                                                                    |
| GET    | `/cards/{cardId}`                                 | session |                    | 200, 404 Error            |                                                                                    |
| PATCH  | `/cards/{cardId}`                                 | session | CardPatch          | 200, 409 Error            |                                                                                    |
| DELETE | `/cards/{cardId}`                                 | session |                    | 204                       |                                                                                    |
| POST   | `/cards/{cardId}/move`                            | session | CardMove           | 200, 409 Error            |                                                                                    |
| GET    | `/workspaces/{workspaceId}/export/tasks.csv`      | session |                    | 200, 403 Error            | Download the tasks as a CSV spreadsheet (needs the export permission)              |
| POST   | `/workspaces/{workspaceId}/import/tasks`          | session |                    | 200, 403 Error, 422 Error | Create tasks from a CSV file; dryRun only reports what would happen                |
| GET    | `/workspaces/{workspaceId}/cards/trash`           | session |                    | 200, 403 Error            | Deleted tasks, newest first (needs the permission to delete tasks)                 |
| POST   | `/cards/{cardId}/restore`                         | session |                    | 200, 404 Error            | Bring a deleted task back, with the subtasks deleted with it                       |
| GET    | `/workspaces/{workspaceId}/analytics/performance` | session |                    | 200, 403 Error            | How the team works over the last 7, 30 or 90 days (needs the analytics permission) |
| GET    | `/workspaces/{workspaceId}/cards/board`           | session |                    | 200                       |                                                                                    |
| GET    | `/workspaces/{workspaceId}/labels`                | session |                    | 200                       |                                                                                    |
| POST   | `/workspaces/{workspaceId}/labels`                | session | LabelInput         | 201, 409 Error            |                                                                                    |
| PATCH  | `/labels/{labelId}`                               | session | LabelPatch         | 200                       |                                                                                    |
| DELETE | `/labels/{labelId}`                               | session |                    | 204                       |                                                                                    |
| GET    | `/cards/{cardId}/checklist`                       | session |                    | 200                       |                                                                                    |
| POST   | `/cards/{cardId}/checklist`                       | session | ChecklistItemInput | 201                       |                                                                                    |
| PATCH  | `/checklist-items/{itemId}`                       | session | ChecklistItemPatch | 200                       |                                                                                    |
| DELETE | `/checklist-items/{itemId}`                       | session |                    | 204                       |                                                                                    |

## support

| Method | Path                                | Auth    | Request             | Responses                 | Summary                                                                      |
| ------ | ----------------------------------- | ------- | ------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/support` | session |                     | 200                       | Support requests; people who manage support see everyone's, others their own |
| POST   | `/workspaces/{workspaceId}/support` | session | SupportRequestInput | 201, 422 Error, 429 Error | Write to the people who run the workspace                                    |
| PATCH  | `/support/{requestId}`              | session | SupportRequestPatch | 200, 403 Error            | Change a request's status (needs the support permission)                     |
| GET    | `/support/{requestId}/screenshot`   | session |                     | 200, 404 Error            |                                                                              |

## customFields

| Method | Path                                             | Auth    | Request             | Responses                 | Summary                                                       |
| ------ | ------------------------------------------------ | ------- | ------------------- | ------------------------- | ------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/custom-fields`        | session |                     | 200                       | Custom fields of the workspace, in display order              |
| POST   | `/workspaces/{workspaceId}/custom-fields`        | session | CustomFieldInput    | 201, 409 Error, 422 Error | Define a field (workspace administrators)                     |
| PUT    | `/workspaces/{workspaceId}/custom-fields/order`  | session |                     | 204                       |                                                               |
| POST   | `/workspaces/{workspaceId}/custom-fields/values` | session |                     | 200                       | Values of many cards at once (for the board); up to 500 cards |
| PATCH  | `/custom-fields/{fieldId}`                       | session | CustomFieldPatch    | 200                       |                                                               |
| DELETE | `/custom-fields/{fieldId}`                       | session |                     | 204                       |                                                               |
| GET    | `/cards/{cardId}/field-values`                   | session |                     | 200                       |                                                               |
| PUT    | `/cards/{cardId}/field-values/{fieldId}`         | session | CardFieldValueInput | 204, 422 Error            | Set a value (null or an empty value clears it)                |

## comments

| Method | Path                       | Auth    | Request      | Responses      | Summary |
| ------ | -------------------------- | ------- | ------------ | -------------- | ------- |
| GET    | `/cards/{cardId}/comments` | session |              | 200            |         |
| POST   | `/cards/{cardId}/comments` | session | CommentInput | 201, 422 Error |         |
| PATCH  | `/comments/{commentId}`    | session | CommentInput | 200, 403 Error |         |
| DELETE | `/comments/{commentId}`    | session |              | 204, 403 Error |         |

## attachments

| Method | Path                                  | Auth    | Request | Responses      | Summary |
| ------ | ------------------------------------- | ------- | ------- | -------------- | ------- |
| GET    | `/cards/{cardId}/attachments`         | session |         | 200            |         |
| POST   | `/cards/{cardId}/attachments`         | session |         | 201, 413 Error |         |
| DELETE | `/attachments/{attachmentId}`         | session |         | 204, 403 Error |         |
| GET    | `/attachments/{attachmentId}/content` | session |         | 200            |         |

## time

| Method | Path                             | Auth    | Request           | Responses                            | Summary                                                 |
| ------ | -------------------------------- | ------- | ----------------- | ------------------------------------ | ------------------------------------------------------- |
| GET    | `/cards/{cardId}/time`           | session |                   | 200                                  |                                                         |
| POST   | `/cards/{cardId}/time`           | session | TimeLogInput      | 201, 422 Error                       |                                                         |
| POST   | `/cards/{cardId}/timer`          | session |                   | 201                                  |                                                         |
| GET    | `/timer`                         | session |                   | 200                                  |                                                         |
| PUT    | `/cards/{cardId}/time-estimate`  | session | TimeEstimateInput | 200, 422 Error                       |                                                         |
| GET    | `/workspaces/{workspaceId}/time` | session |                   | 200, 403 Error, 422 Error            | One person's time entries in a period, with their tasks |
| PATCH  | `/time-entries/{entryId}`        | session | TimeEntryPatch    | 200, 403 Error, 409 Error, 422 Error |                                                         |
| DELETE | `/time-entries/{entryId}`        | session |                   | 204, 403 Error                       |                                                         |
| POST   | `/time-entries/{entryId}/stop`   | session |                   | 200, 409 Error                       |                                                         |

## activity

| Method | Path                       | Auth    | Request | Responses | Summary |
| ------ | -------------------------- | ------- | ------- | --------- | ------- |
| GET    | `/cards/{cardId}/activity` | session |         | 200       |         |

## realtime

| Method | Path                               | Auth    | Request | Responses | Summary |
| ------ | ---------------------------------- | ------- | ------- | --------- | ------- |
| GET    | `/workspaces/{workspaceId}/events` | session |         | 200       |         |

## wiki

| Method | Path                                                      | Auth    | Request             | Responses                                       | Summary                                                                                                              |
| ------ | --------------------------------------------------------- | ------- | ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/wiki/spaces`                   | session |                     | 200                                             |                                                                                                                      |
| POST   | `/workspaces/{workspaceId}/wiki/spaces`                   | session | WikiSpaceInput      | 201, 422 Error                                  |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/trash`                    | session |                     | 200                                             |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/favorites`                | session |                     | 200                                             |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/recent`                   | session |                     | 200                                             |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/shared`                   | session |                     | 200                                             |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/private`                  | session |                     | 200                                             |                                                                                                                      |
| GET    | `/wiki/spaces/{spaceId}`                                  | session |                     | 200, 404 Error                                  |                                                                                                                      |
| PATCH  | `/wiki/spaces/{spaceId}`                                  | session | WikiSpacePatch      | 200, 403 Error, 422 Error                       |                                                                                                                      |
| DELETE | `/wiki/spaces/{spaceId}`                                  | session |                     | 204, 403 Error                                  |                                                                                                                      |
| GET    | `/wiki/spaces/{spaceId}/tree`                             | session |                     | 200, 404 Error                                  |                                                                                                                      |
| POST   | `/wiki/spaces/{spaceId}/nodes`                            | session | WikiNodeInput       | 201, 403 Error, 422 Error                       |                                                                                                                      |
| GET    | `/wiki/spaces/{spaceId}/audit`                            | session |                     | 200, 403 Error                                  |                                                                                                                      |
| GET    | `/wiki/spaces/{spaceId}/access`                           | session |                     | 200                                             |                                                                                                                      |
| PUT    | `/wiki/spaces/{spaceId}/visibility`                       | session | WikiVisibilityInput | 200, 403 Error                                  |                                                                                                                      |
| PUT    | `/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}` | session | WikiGrantInput      | 200, 403 Error, 422 Error                       |                                                                                                                      |
| DELETE | `/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}` | session |                     | 204, 403 Error                                  |                                                                                                                      |
| GET    | `/wiki/nodes/{nodeId}`                                    | session |                     | 200, 404 Error                                  |                                                                                                                      |
| PATCH  | `/wiki/nodes/{nodeId}`                                    | session | WikiNodePatch       | 200, 403 Error, 422 Error                       |                                                                                                                      |
| DELETE | `/wiki/nodes/{nodeId}`                                    | session |                     | 204, 403 Error                                  |                                                                                                                      |
| POST   | `/wiki/nodes/{nodeId}/move`                               | session | WikiMoveInput       | 200, 403 Error, 409 Error, 422 Error            |                                                                                                                      |
| POST   | `/wiki/nodes/{nodeId}/restore`                            | session |                     | 200, 409 Error                                  |                                                                                                                      |
| DELETE | `/wiki/nodes/{nodeId}/purge`                              | session |                     | 204, 409 Error                                  |                                                                                                                      |
| GET    | `/wiki/nodes/{nodeId}/content`                            | session |                     | 200, 404 Error                                  |                                                                                                                      |
| PUT    | `/wiki/nodes/{nodeId}/content`                            | session | WikiContentInput    | 200, 403 Error, 409 Error, 413 Error, 422 Error |                                                                                                                      |
| POST   | `/wiki/nodes/{nodeId}/files`                              | session |                     | 201, 403 Error, 413 Error                       |                                                                                                                      |
| GET    | `/wiki/spaces/{spaceId}/export`                           | session |                     | 200, 404 Error                                  | Download every page of the space the caller can read, as a zip of Markdown or HTML files                             |
| GET    | `/wiki/nodes/{nodeId}/export`                             | session |                     | 200, 404 Error                                  | Download a page (one file when it has no attachments, else a zip) or, with subtree, a folder and everything below it |
| GET    | `/wiki/files/{fileId}/content`                            | session |                     | 200, 404 Error                                  |                                                                                                                      |
| GET    | `/workspaces/{workspaceId}/wiki/templates`                | session |                     | 200                                             |                                                                                                                      |
| POST   | `/workspaces/{workspaceId}/wiki/templates`                | session | WikiTemplateInput   | 201, 403 Error, 422 Error                       |                                                                                                                      |
| DELETE | `/workspaces/{workspaceId}/wiki/templates/{templateId}`   | session |                     | 204, 403 Error                                  |                                                                                                                      |
| PUT    | `/wiki/nodes/{nodeId}/favorite`                           | session |                     | 204                                             |                                                                                                                      |
| DELETE | `/wiki/nodes/{nodeId}/favorite`                           | session |                     | 204                                             |                                                                                                                      |
| GET    | `/wiki/nodes/{nodeId}/access`                             | session |                     | 200                                             |                                                                                                                      |
| PUT    | `/wiki/nodes/{nodeId}/visibility`                         | session | WikiVisibilityInput | 200, 403 Error                                  |                                                                                                                      |
| PUT    | `/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}`   | session | WikiGrantInput      | 200, 403 Error, 422 Error                       |                                                                                                                      |
| DELETE | `/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}`   | session |                     | 204, 403 Error                                  |                                                                                                                      |

## system

| Method | Path                | Auth   | Request | Responses | Summary |
| ------ | ------------------- | ------ | ------- | --------- | ------- |
| GET    | `/i18n/error-codes` | public |         | 200       |         |

## chat

| Method | Path                                         | Auth    | Request          | Responses                 | Summary                                                                  |
| ------ | -------------------------------------------- | ------- | ---------------- | ------------------------- | ------------------------------------------------------------------------ |
| GET    | `/workspaces/{workspaceId}/chat/channels`    | session |                  | 200                       | Channels the caller can see, with unread and mention counts              |
| POST   | `/workspaces/{workspaceId}/chat/channels`    | session | ChatChannelInput | 201, 409 Error, 422 Error |                                                                          |
| POST   | `/workspaces/{workspaceId}/chat/direct`      | session | ChatDirectInput  | 200, 422 Error            | Open (or create) the direct conversation with the given people           |
| POST   | `/projects/{projectId}/chat`                 | session |                  | 200                       | The project's conversation (created on first use; the caller joins it)   |
| POST   | `/cards/{cardId}/chat`                       | session |                  | 200                       | The card's conversation (created on first use; the caller joins it)      |
| GET    | `/workspaces/{workspaceId}/chat/search`      | session |                  | 200                       | Find messages containing the text in conversations the caller can see    |
| GET    | `/workspaces/{workspaceId}/chat/saved`       | session |                  | 200                       | The caller's saved (Later) messages, newest saved first                  |
| GET    | `/workspaces/{workspaceId}/chat/threads`     | session |                  | 200                       | Threads the caller started or replied in, most recently active first     |
| GET    | `/workspaces/{workspaceId}/chat/presence`    | session |                  | 200                       |                                                                          |
| POST   | `/workspaces/{workspaceId}/chat/presence`    | session |                  | 204                       | Tell the server the caller has the app open                              |
| PUT    | `/workspaces/{workspaceId}/chat/status`      | session | ChatStatusInput  | 204, 422 Error            | Set the caller's status (availability, icon, short text, optional end)   |
| DELETE | `/workspaces/{workspaceId}/chat/status`      | session |                  | 204                       |                                                                          |
| POST   | `/chat/channels/{channelId}/typing`          | session |                  | 204                       | Tell the others in the channel the caller is writing (nothing is stored) |
| PUT    | `/chat/channels/{channelId}/star`            | session |                  | 204                       |                                                                          |
| DELETE | `/chat/channels/{channelId}/star`            | session |                  | 204                       |                                                                          |
| GET    | `/chat/channels/{channelId}/pins`            | session |                  | 200                       |                                                                          |
| GET    | `/chat/channels/{channelId}/files`           | session |                  | 200                       |                                                                          |
| POST   | `/chat/channels/{channelId}/files`           | session |                  | 201, 413 Error            |                                                                          |
| GET    | `/chat/files/{fileId}/content`               | session |                  | 200, 404 Error            |                                                                          |
| PUT    | `/chat/messages/{messageId}/save`            | session |                  | 200                       |                                                                          |
| DELETE | `/chat/messages/{messageId}/save`            | session |                  | 200                       |                                                                          |
| PUT    | `/chat/messages/{messageId}/pin`             | session |                  | 200                       |                                                                          |
| DELETE | `/chat/messages/{messageId}/pin`             | session |                  | 200                       |                                                                          |
| PATCH  | `/chat/channels/{channelId}`                 | session | ChatChannelPatch | 200, 409 Error, 422 Error |                                                                          |
| DELETE | `/chat/channels/{channelId}`                 | session |                  | 204                       | Archive a channel (creator or workspace admin)                           |
| GET    | `/chat/channels/{channelId}/members`         | session |                  | 200                       |                                                                          |
| POST   | `/chat/channels/{channelId}/members`         | session | ChatMembersInput | 204                       |                                                                          |
| POST   | `/chat/channels/{channelId}/join`            | session |                  | 200                       |                                                                          |
| POST   | `/chat/channels/{channelId}/leave`           | session |                  | 204                       |                                                                          |
| POST   | `/chat/channels/{channelId}/read`            | session |                  | 204                       | Mark the channel as read up to now                                       |
| PUT    | `/chat/channels/{channelId}/notify`          | session | ChatNotifyInput  | 204                       | Choose how loudly the channel notifies the caller                        |
| GET    | `/chat/channels/{channelId}/messages`        | session |                  | 200                       | A page of top-level messages, oldest first within the page               |
| POST   | `/chat/channels/{channelId}/messages`        | session | ChatMessageInput | 201, 422 Error            | Send a message, or a reply when parentId is set                          |
| PATCH  | `/chat/messages/{messageId}`                 | session | ChatBodyInput    | 200, 422 Error            |                                                                          |
| DELETE | `/chat/messages/{messageId}`                 | session |                  | 204                       |                                                                          |
| GET    | `/chat/messages/{messageId}/thread`          | session |                  | 200                       |                                                                          |
| PUT    | `/chat/messages/{messageId}/reactions/{key}` | session |                  | 200                       |                                                                          |
| DELETE | `/chat/messages/{messageId}/reactions/{key}` | session |                  | 200                       |                                                                          |

## integrations

| Method | Path                                                        | Auth    | Request          | Responses      | Summary                                                                        |
| ------ | ----------------------------------------------------------- | ------- | ---------------- | -------------- | ------------------------------------------------------------------------------ |
| GET    | `/workspaces/{workspaceId}/integrations`                    | session |                  | 200            | What can be connected and where each stands for the caller                     |
| GET    | `/workspaces/{workspaceId}/integrations/meetings`           | session |                  | 200            | The caller's next calendar meetings, soonest first                             |
| POST   | `/workspaces/{workspaceId}/integrations/{provider}/connect` | session |                  | 200, 409 Error | Start connecting an account; returns where to send the browser                 |
| PATCH  | `/workspaces/{workspaceId}/integrations/{provider}`         | session | IntegrationPatch | 200, 422 Error | Activate or pause a connection and change its reminders                        |
| DELETE | `/workspaces/{workspaceId}/integrations/{provider}`         | session |                  | 204            | Forget the account and its cached events                                       |
| POST   | `/workspaces/{workspaceId}/integrations/{provider}/sync`    | session |                  | 200            | Refresh the connection now                                                     |
| GET    | `/integrations/{provider}/callback`                         | public  |                  | 302            | Where the provider sends the browser back (redirects to the Integrations page) |

## github

| Method | Path                                               | Auth    | Request          | Responses                 | Summary                                                                                |
| ------ | -------------------------------------------------- | ------- | ---------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/github`                 | session |                  | 200                       | The workspace's GitHub connection, rules and linked repositories                       |
| PATCH  | `/workspaces/{workspaceId}/github`                 | session | GithubPatch      | 200                       | Switch the connection on or off and change its rules (administrators)                  |
| DELETE | `/workspaces/{workspaceId}/github`                 | session |                  | 204                       | Remove the webhooks, the token, the repositories and the links (administrators)        |
| PUT    | `/workspaces/{workspaceId}/github/token`           | session | GithubTokenInput | 200, 422 Error            | Connect with an access token (administrators); the token is checked and stored sealed  |
| GET    | `/workspaces/{workspaceId}/github/repos/available` | session |                  | 200                       | Repositories the token can reach that are not linked yet (administrators)              |
| POST   | `/workspaces/{workspaceId}/github/repos`           | session | GithubRepoInput  | 201, 409 Error, 422 Error | Link a project to a repository and register the webhook (administrators)               |
| DELETE | `/workspaces/{workspaceId}/github/repos/{repoId}`  | session |                  | 204                       | Unlink a repository and remove its webhook (administrators)                            |
| GET    | `/cards/{cardId}/github`                           | session |                  | 200                       | Pull requests and issues linked to a card, with a suggested branch name                |
| POST   | `/cards/{cardId}/github/issue`                     | session |                  | 201, 409 Error            | Open a GitHub issue for the card in its project's repository                           |
| POST   | `/integrations/github/webhook`                     | public  |                  | 204, 401 Error            | Where GitHub delivers pull request and issue events (signed with the workspace secret) |

## templates

| Method | Path                                  | Auth    | Request            | Responses                 | Summary                                                           |
| ------ | ------------------------------------- | ------- | ------------------ | ------------------------- | ----------------------------------------------------------------- |
| GET    | `/workspaces/{workspaceId}/templates` | session |                    | 200                       |                                                                   |
| POST   | `/workspaces/{workspaceId}/templates` | session | TaskTemplateInput  | 201, 409 Error, 422 Error |                                                                   |
| PUT    | `/templates/{templateId}`             | session | TaskTemplateInput  | 200, 409 Error, 422 Error |                                                                   |
| DELETE | `/templates/{templateId}`             | session |                    | 204                       |                                                                   |
| POST   | `/templates/{templateId}/use`         | session | UseTemplateRequest | 201, 422 Error            | Create a task (with its checklist and subtasks) from the template |
| GET    | `/workspaces/{workspaceId}/recurring` | session |                    | 200                       |                                                                   |
| POST   | `/workspaces/{workspaceId}/recurring` | session | RecurringTaskInput | 201, 422 Error            |                                                                   |
| PUT    | `/recurring/{recurringId}`            | session | RecurringTaskInput | 200, 422 Error            |                                                                   |
| DELETE | `/recurring/{recurringId}`            | session |                    | 204                       |                                                                   |

## Schemas

- **TaskTemplateInput** — `name`: string, `title`: string, `description?`: string, `priority?`: Priority, `labelIds?`: array, `assigneeIds?`: array, `checklist?`: array, `subtasks?`: array, `dueInDays?`: integer \| null
- **TaskTemplate** — `id`: string, `name`: string, `title`: string, `description`: string, `priority`: Priority, `labelIds`: array, `assigneeIds`: array, `checklist`: array, `subtasks`: array, `dueInDays`: integer \| null, `createdAt`: string
- **UseTemplateRequest** — `projectId`: string, `columnId?`: string \| null, `title?`: string \| null, `dueDate?`: string \| null
- **RecurringTaskInput** — `templateId`: string, `projectId`: string, `freq`: string, `weekdays?`: array, `monthDay?`: integer, `hour`: integer, `timezone?`: string, `active?`: boolean
- **RecurringTask** — `id`: string, `templateId`: string, `projectId`: string, `freq`: string, `weekdays`: array, `monthDay`: integer \| null, `hour`: integer, `timezone`: string, `active`: boolean, `nextRunAt`: string, `lastRunAt`: string \| null, `lastCardId`: string \| null, `lastError`: string \| null
- **ErrorResponse** — `error`: object
- **FieldError** — `field`: string, `code`: string, `params?`: object
- **CsrfToken** — `token`: string
- **AuthProviders** — `google`: boolean, `github`: boolean
- **Locale**: `en` | `uk`
- **User** — `id`: string, `email`: string, `name`: string, `locale`: Locale, `avatarUrl`: string \| null, `emailVerified`: boolean, `hasPassword`: boolean, `providers`: array, `createdAt`: string, `jobTitle`: string, `phone`: string, `location`: string, `timezone`: string, `bio`: string, `pronouns`: string, `linkedin`: string, `telegram`: string, `whatsapp`: string, `onboarded`: boolean, `website`: string, `workStart`: string, `workEnd`: string, `skills`: array, `coverPreset`: string, `coverUrl`: string \| null
- **Session** — `user`: User
- **RegisterRequest** — `name`: string, `email`: string, `password`: string, `locale?`: Locale
- **LoginRequest** — `email`: string, `password`: string
- **TokenRequest** — `token`: string
- **EmailRequest** — `email`: string
- **ResetPasswordRequest** — `token`: string, `password`: string
- **TwoFactorStatus** — `enabled`: boolean, `recoveryRemaining`: integer
- **TwoFactorSetup** — `secret`: string, `uri`: string
- **CodeRequest** — `code`: string
- **RecoveryCodes** — `codes`: array
- **TwoFactorDisableRequest** — `code`: string, `password?`: string
- **TwoFactorLoginRequest** — `token`: string, `code`: string
- **ChangePasswordRequest** — `currentPassword?`: string, `newPassword`: string
- **Device** — `id`: string, `startedAt`: string, `lastSeenAt`: string, `userAgent`: string, `ip`: string, `current`: boolean
- **DeviceList** — `items`: array
- **UpdateProfileRequest** — `name?`: string, `locale?`: Locale, `jobTitle?`: string, `phone?`: string, `location?`: string, `timezone?`: string, `bio?`: string, `pronouns?`: string, `linkedin?`: string, `telegram?`: string, `whatsapp?`: string, `website?`: string, `workStart?`: string, `workEnd?`: string, `skills?`: array, `coverPreset?`: string
- **Role**: `owner` | `admin` | `member` | `viewer`
- **InviteRole**: `admin` | `member` | `viewer`
- **Workspace** — `id`: string, `name`: string, `slug`: string, `twoFactorBlocked`: boolean, `role`: Role, `permissions`: array, `customRole`: object \| null, `memberCount`: integer, `createdAt`: string
- **WorkspaceInput** — `name`: string
- **WorkspaceFeatures** — `chat`: boolean, `docs`: boolean, `time`: boolean, `calendar`: boolean, `integrations`: boolean
- **WorkspaceSettings** — `description`: string, `inviteDays`: integer, `defaultInviteRole`: InviteRole, `allowedDomains`: array, `defaultPriority`: string, `requireDueDate`: boolean, `weekStart`: integer, `requireAssignee`: boolean, `chatAllowDirect`: boolean, `chatAllowFiles`: boolean, `chatEditMinutes`: integer, `timeAllowManual`: boolean, `requireTwoFactor`: boolean, `docsVisibility`: string, `docsMaxDepth`: integer, `accentColor`: string, `icon`: string, `features`: WorkspaceFeatures
- **WorkspaceSettingsPatch** — `description?`: string, `inviteDays?`: integer, `defaultInviteRole?`: InviteRole, `allowedDomains?`: array, `defaultPriority?`: string, `requireDueDate?`: boolean, `weekStart?`: integer, `requireAssignee?`: boolean, `chatAllowDirect?`: boolean, `chatAllowFiles?`: boolean, `chatEditMinutes?`: integer, `timeAllowManual?`: boolean, `requireTwoFactor?`: boolean, `docsVisibility?`: string, `docsMaxDepth?`: integer, `accentColor?`: string, `icon?`: string, `features?`: WorkspaceFeatures
- **AuditEntry** — `id`: string, `actor`: object \| null, `action`: string, `details`: object, `at`: string
- **PermissionInfo** — `key`: string, `group`: string, `fixed`: boolean
- **RoleDefinition** — `key`: string, `id`: string \| null, `custom`: boolean, `name`: string, `description`: string, `base`: Role, `permissions`: array, `defaults`: array, `changed`: boolean, `locked`: boolean, `members`: integer
- **RolesOverview** — `catalog`: array, `roles`: array
- **RoleInput** — `name`: string, `description?`: string, `base`: string, `permissions`: array
- **PermissionsInput** — `permissions`: array
- **RoleRef** — `id`: string, `name`: string
- **MailItem** — `id`: integer, `recipient`: string, `subject`: string, `status`: string, `attempts`: integer, `error`: string \| null, `at`: string
- **MailStatus** — `provider`: string, `host`: string, `from`: string, `capturing`: boolean, `waiting`: integer, `failed`: integer, `recent`: array
- **MemberUser** — `id`: string, `name`: string, `email`: string, `avatarUrl`: string \| null, `jobTitle`: string
- **MemberProfile** — `id`: string, `name`: string, `email`: string, `avatarUrl`: string \| null, `role`: Role, `joinedAt`: string, `jobTitle`: string, `pronouns`: string, `phone`: string, `location`: string, `timezone`: string, `bio`: string, `linkedin`: string, `telegram`: string, `whatsapp`: string, `website`: string, `workStart`: string, `workEnd`: string, `skills`: array, `coverPreset`: string, `coverUrl`: string \| null
- **Member** — `user`: MemberUser, `role`: Role, `customRole`: object \| null, `joinedAt`: string
- **UpdateMemberRequest** — `role`: Role
- **Invite** — `id`: string, `email`: string, `role`: InviteRole, `expiresAt`: string, `createdAt`: string, `link?`: string
- **CreateInviteRequest** — `email`: string, `role`: InviteRole
- **InvitePreview** — `workspaceName`: string, `inviterName`: string \| null, `email`: string, `role`: InviteRole, `expired`: boolean, `accepted`: boolean, `hasAccount`: boolean
- **TaskStatus**: `todo` | `in_progress` | `in_review` | `done`
- **Priority**: `high` | `medium` | `low`
- **ProjectStatus**: `pending` | `in_progress` | `completed`
- **Tone**: `teal` | `amber` | `purple` | `red` | `neutral`
- **ProjectIcon**: `folder` | `rocket` | `shield` | `code` | `target` | `sparkles` | `globe` | `megaphone` | `layers` | `flask`
- **PersonRef** — `id`: string, `name`: string, `avatarUrl`: string \| null
- **ProjectRef** — `id`: string, `key`: string, `name`: string, `tone`: Tone, `icon`: ProjectIcon
- **Project** — `id`: string, `key`: string, `name`: string, `description`: string, `status`: ProjectStatus, `overdue`: boolean, `pic`: object \| null, `picRole`: object \| null, `team`: string \| null, `icon`: ProjectIcon, `tone`: Tone, `startDate`: string \| null, `deadline`: string \| null, `taskCount`: integer, `doneCount`: integer, `progress`: integer, `createdAt`: string, `updatedAt`: string
- **ProjectInput** — `name`: string, `key?`: string, `description?`: string, `status?`: ProjectStatus, `picId?`: string, `team?`: string, `icon?`: ProjectIcon, `tone?`: Tone, `startDate?`: string, `deadline?`: string
- **ProjectPatch** — `name?`: string, `description?`: string, `status?`: ProjectStatus, `picId?`: string \| null, `team?`: string \| null, `icon?`: ProjectIcon, `tone?`: Tone, `startDate?`: string \| null, `deadline?`: string \| null
- **ProjectPage** — `items`: array, `total`: integer, `page`: integer, `pageSize`: integer
- **ProjectSummary** — `total`: integer, `completed`: integer, `inProgress`: integer, `pending`: integer, `overdue`: integer, `teams`: array
- **BoardColumn** — `id`: string, `name`: string, `status`: TaskStatus, `position`: string, `wipLimit`: integer \| null
- **Board** — `id`: string, `projectId`: string, `name`: string, `columns`: array
- **Card** — `id`: string, `key`: string, `number`: integer, `title`: string, `description`: string, `status`: TaskStatus, `columnId`: string, `priority`: Priority, `progress`: integer, `dueDate`: string \| null, `project`: ProjectRef, `assignees`: array, `labels`: array, `checklist`: ChecklistSummary, `subtasks`: ChecklistSummary, `parent?`: CardParent, `commentCount`: integer, `attachmentCount`: integer, `position`: string, `version`: integer, `createdAt`: string, `updatedAt`: string, `completedAt`: string \| null
- **CardParent** — `id`: string, `key`: string, `title`: string
- **CardInput** — `projectId`: string, `title`: string, `description?`: string, `status?`: TaskStatus, `columnId?`: string, `priority?`: Priority, `dueDate?`: string, `assigneeIds?`: array, `labelIds?`: array, `parentId?`: string
- **CardPatch** — `version`: integer, `title?`: string, `description?`: string, `priority?`: Priority, `dueDate?`: string \| null, `assigneeIds?`: array, `labelIds?`: array
- **CardMove** — `version`: integer, `columnId?`: string, `status?`: TaskStatus, `afterId?`: string \| null, `beforeId?`: string \| null
- **TrashItem** — `card`: Card, `deletedAt`: string
- **TrashList** — `items`: array
- **CardBoard** — `items`: array, `truncated`: boolean
- **FieldOption** — `id`: string, `label`: string, `tone`: Tone
- **CustomFieldKind**: `text` | `number` | `date` | `select` | `checkbox` | `url`
- **CustomField** — `id`: string, `name`: string, `description`: string, `kind`: CustomFieldKind, `options`: array, `showOnCard`: boolean, `position`: integer
- **CustomFieldInput** — `name`: string, `description?`: string, `kind`: CustomFieldKind, `options?`: array, `showOnCard?`: boolean
- **CustomFieldPatch** — `name?`: string, `description?`: string, `options?`: array, `showOnCard?`: boolean
- **CardFieldValue** — `cardId`: string, `fieldId`: string, `value`: object
- **CardFieldValueInput** — `value`: object \| null
- **Label** — `id`: string, `name`: string, `tone`: Tone
- **LabelInput** — `name`: string, `tone?`: Tone
- **LabelPatch** — `name?`: string, `tone?`: Tone
- **ChecklistSummary** — `total`: integer, `done`: integer
- **ChecklistItem** — `id`: string, `text`: string, `done`: boolean, `position`: string, `completedAt`: string \| null
- **ChecklistItemInput** — `text`: string
- **ChecklistItemPatch** — `text?`: string, `done?`: boolean, `move?`: Neighbours
- **Neighbours** — `afterId?`: string \| null, `beforeId?`: string \| null
- **ColumnInput** — `name`: string, `status`: TaskStatus, `wipLimit?`: integer \| null
- **ColumnPatch** — `name?`: string, `wipLimit?`: integer \| null
- **SavedView** — `id`: string, `name`: string, `config`: object, `createdAt`: string, `updatedAt`: string
- **SavedViewInput** — `name`: string, `config`: object
- **SavedViewPatch** — `name?`: string, `config?`: object
- **Comment** — `id`: string, `cardId`: string, `author`: object \| null, `body`: string, `mentions`: array, `createdAt`: string, `editedAt`: string \| null
- **CommentInput** — `body`: string
- **Attachment** — `id`: string, `name`: string, `contentType`: string, `size`: integer, `previewable`: boolean, `uploadedBy`: object \| null, `createdAt`: string
- **TimeEntry** — `id`: string, `cardId`: string, `user`: object \| null, `startedAt`: string, `endedAt`: string \| null, `seconds`: integer, `running`: boolean, `note`: string, `manual`: boolean
- **TimeSummary** — `entries`: array, `totalSeconds`: integer, `estimateSeconds`: integer \| null
- **TimeEstimateInput** — `seconds`: integer \| null
- **TimeEstimate** — `seconds`: integer \| null
- **TimeEntryPatch** — `seconds?`: integer, `note?`: string, `startedAt?`: string
- **TimesheetEntry** — `entry`: TimeEntry, `card`: TimesheetCard
- **TimesheetCard** — `id`: string, `key`: string, `title`: string, `project`: ProjectRef
- **Timesheet** — `entries`: array, `totalSeconds`: integer
- **TimeLogInput** — `seconds`: integer, `note?`: string, `startedAt?`: string
- **RunningTimer** — `entry?`: TimeEntry
- **ActivityEntry** — `id`: integer, `kind`: string, `data`: object, `actor`: object \| null, `at`: string
- **ActivityPage** — `items`: array, `nextBefore`: integer \| null
- **RealtimeMessage** — `type`: string, `workspaceId`: string, `projectId?`: string, `cardId?`: string, `actorId?`: string, `channelId?`: string, `messageId?`: string, `userId?`: string
- **CardPage** — `items`: array, `total`: integer, `page`: integer, `pageSize`: integer
- **StatusCounts** — `todo`: integer, `in_progress`: integer, `in_review`: integer, `done`: integer
- **BulkCardAction** — `ids`: array, `action`: string, `status?`: TaskStatus, `priority?`: Priority
- **BulkResult** — `updated`: integer
- **DailyActivity** — `date`: string, `todo`: integer, `in_progress`: integer, `in_review`: integer, `done`: integer
- **ActivityItem** — `id`: integer, `card`: object, `project`: ProjectRef, `actor`: object \| null, `from`: object \| null, `to`: TaskStatus, `at`: string
- **Trend** — `value`: integer, `previous`: integer, `changePct`: number \| null
- **DashboardStats** — `active`: integer, `total`: integer, `inReview`: integer, `overdue`: integer, `completedThisWeek`: Trend, `createdThisWeek`: Trend, `statusCounts`: StatusCounts, `daily`: array, `activity`: array
- **WikiVisibility**: `private` | `shared` | `workspace`
- **WikiStatus**: `draft` | `published` | `outdated`
- **WikiRole**: `owner` | `editor` | `commenter` | `viewer`
- **WikiWorkspaceRole**: `viewer` | `commenter` | `editor`
- **WikiPrincipalKind**: `user` | `team`
- **WikiAccess** — `role`: object \| null, `via`: string, `visibility`: WikiVisibility, `visibilitySourceId`: string
- **WikiSpace** — `id`: string, `workspaceId`: string, `ownerId`: string, `name`: string, `icon`: string, `color`: string, `description`: string, `visibility`: WikiVisibility, `workspaceRole`: WikiWorkspaceRole, `maxDepth`: integer, `access`: WikiAccess, `createdAt`: string, `updatedAt`: string
- **WikiSpaceInput** — `name`: string, `icon?`: string, `color?`: string, `description?`: string, `visibility?`: WikiVisibility, `workspaceRole?`: WikiWorkspaceRole, `maxDepth?`: integer
- **WikiSpacePatch** — `name?`: string, `icon?`: string, `color?`: string, `description?`: string, `maxDepth?`: integer
- **WikiNode** — `id`: string, `spaceId`: string, `parentId`: string \| null, `kind`: string, `title`: string, `icon`: string, `cover`: string, `rank`: string, `depth`: integer, `visibility`: object \| null, `ownerId`: string, `favorite`: boolean, `access`: WikiAccess, `status`: WikiStatus, `tags`: array, `lastVerifiedAt`: string \| null, `reviewDays`: integer, `reviewDue`: boolean, `fullWidth`: boolean, `projectIds`: array, `deletedAt?`: string \| null, `createdAt`: string, `updatedAt`: string
- **WikiTreeNode** —
- **WikiTree** — `space`: WikiSpace, `nodes`: array
- **WikiNodeInput** — `parentId?`: string \| null, `kind`: string, `title`: string, `icon?`: string, `afterId?`: string \| null, `templateId?`: string, `lang?`: string
- **WikiNodePatch** — `title?`: string, `icon?`: string, `cover?`: string, `status?`: WikiStatus, `tags?`: array, `reviewDays?`: integer, `fullWidth?`: boolean, `verify?`: boolean, `projectIds?`: array
- **WikiMoveInput** — `spaceId?`: string \| null, `parentId?`: string \| null, `beforeId?`: string \| null, `afterId?`: string \| null, `confirmWiden?`: boolean
- **ImportRow** — `line`: integer, `title`: string, `error?`: string, `warnings`: array
- **ImportResult** — `dryRun`: boolean, `created`: integer, `skipped`: integer, `rows`: array
- **DurationStat** — `samples`: integer, `avgHours`: number \| null, `medianHours`: number \| null, `previousAvgHours`: number \| null
- **PerformanceDay** — `date`: string, `todo`: integer, `inProgress`: integer, `inReview`: integer, `done`: integer, `createdTotal`: integer, `doneTotal`: integer
- **PerformanceWeek** — `start`: string, `created`: integer, `done`: integer
- **PerformanceBucket** — `upToDays`: integer \| null, `count`: integer
- **PerformanceAged** — `id`: string, `key`: string, `title`: string, `project`: ProjectRef, `status`: TaskStatus, `ageHours`: number, `assignees`: array
- **PerformancePerson** — `person`: PersonRef, `open`: integer, `done`: integer, `overdue`: integer
- **PerformanceProject** — `project`: ProjectRef, `total`: integer, `done`: integer, `overdue`: integer, `doneInPeriod`: integer, `donePrevious`: integer
- **PerformanceReport** — `days`: integer, `throughput`: Trend, `cycleTime`: DurationStat, `leadTime`: DurationStat, `lateDone`: integer, `doneWithDue`: integer, `previousLateDone`: integer, `previousDoneWithDue`: integer, `overdueNow`: integer, `wipInProgress`: integer, `wipInReview`: integer, `weekly`: array, `daily`: array, `histogram`: array, `aged`: array, `people`: array, `unassignedOpen`: integer, `projects`: array
- **SupportKind**: `problem` | `idea` | `question`
- **SupportStatus**: `new` | `in_progress` | `resolved`
- **SupportScreenshotInput** — `contentType`: string, `data`: string
- **SupportRequestInput** — `kind`: SupportKind, `subject`: string, `message`: string, `pageUrl?`: string, `userAgent?`: string, `screenshot?`: SupportScreenshotInput
- **SupportRequestPatch** — `status`: SupportStatus
- **SupportRequest** — `id`: string, `kind`: SupportKind, `subject`: string, `message`: string, `pageUrl`: string, `userAgent`: string, `hasScreenshot`: boolean, `status`: SupportStatus, `author`: object \| null, `createdAt`: string, `updatedAt`: string, `resolvedAt`: string \| null
- **BuildInfo** — `version`: string, `commit`: string, `builtAt`: string, `goVersion`: string, `database`: string
- **WikiTrashItem** — `node`: WikiNode, `expiresAt`: string
- **WikiVisibilityInput** — `visibility`: object \| null, `workspaceRole?`: WikiWorkspaceRole
- **WikiGrantInput** — `role`: WikiRole
- **WikiGrant** — `kind`: WikiPrincipalKind, `principalId`: string, `role`: WikiRole, `inherited`: boolean, `sourceId`: string, `source`: string, `sourceTitle`: string
- **WikiAccessSummary** — `role`: object \| null, `via`: string, `visibility`: WikiVisibility, `workspaceRole`: WikiWorkspaceRole, `own?`: object \| null, `inherited`: boolean, `sourceId`: string, `source`: string, `sourceTitle`: string, `ownerId`: string, `canManage`: boolean, `grants`: array
- **WikiContent** — `doc`: object, `version`: integer, `updatedBy`: string \| null, `updatedAt`: string
- **WikiContentInput** — `doc`: object, `version`: integer
- **WikiTemplate** — `id`: string, `name`: string, `description`: string, `icon`: string, `builtin`: boolean
- **WikiTemplateInput** — `name`: string, `description?`: string, `nodeId`: string
- **WikiFile** — `id`: string, `name`: string, `contentType`: string, `size`: integer, `url`: string
- **WikiAuditEvent** — `id`: integer, `kind`: string, `actorId`: string \| null, `nodeId`: string \| null, `data`: object, `at`: string
- **WikiAuditPage** — `events`: array, `next`: integer \| null
- **GithubRules** — `prOpenedToReview`: boolean, `prMergedToDone`: boolean, `syncIssues`: boolean, `commentOnPr`: boolean
- **GithubRepo** — `id`: string, `fullName`: string, `projectId`: string
- **GithubSummary** — `connected`: boolean, `enabled`: boolean, `account`: string, `webhookUrl`: string, `canManage`: boolean, `rules`: GithubRules, `repos`: array
- **GithubPatch** — `enabled?`: boolean, `prOpenedToReview?`: boolean, `prMergedToDone?`: boolean, `syncIssues?`: boolean, `commentOnPr?`: boolean
- **GithubTokenInput** — `token`: string
- **GithubRepoInput** — `projectId`: string, `repo`: string
- **GithubRepoNames** — `items`: array
- **GithubLink** — `id`: string, `kind`: string, `number`: integer, `title`: string, `state`: string, `url`: string, `repo`: string, `author`: string
- **GithubPanel** — `active`: boolean, `repo`: string, `branch`: string, `canCreateIssue`: boolean, `links`: array
- **IntegrationEntry** — `provider`: string, `configured`: boolean, `redirectUri`: string, `connected`: boolean, `enabled`: boolean, `accountEmail`: string, `leadMinutes`: integer, `notifyBell`: boolean, `channelId`: string \| null, `status`: string, `lastError`: string, `lastSyncAt`: string \| null
- **IntegrationList** — `items`: array, `leadChoices`: array
- **IntegrationPatch** — `enabled?`: boolean, `leadMinutes?`: integer, `notifyBell?`: boolean, `channelId?`: string, `clearChannel?`: boolean
- **IntegrationConnect** — `url`: string
- **Meeting** — `id`: string, `provider`: string, `title`: string, `startsAt`: string, `endsAt`: string, `location`: string, `url`: string, `attendees`: array
- **MeetingList** — `items`: array
- **ChatMeeting** — `kind`: string, `title`: string, `startsAt`: string, `endsAt`: string, `location?`: string, `link?`: string, `leadMinutes`: integer, `attendees`: integer
- **NotificationPref** — `kind`: string, `enabled`: boolean
- **NotificationPrefs** — `items`: array
- **NotificationPrefInput** — `kind`: string, `enabled`: boolean
- **Notification** — `id`: string, `kind`: string, `title`: string, `body`: string, `actor`: object \| null, `cardId`: string \| null, `projectId`: string \| null, `channelId`: string \| null, `messageId`: string \| null, `link`: string \| null, `createdAt`: string, `read`: boolean
- **NotificationPage** — `items`: array, `unread`: integer, `next`: string \| null
- **NotificationsReadInput** — `ids?`: array, `all?`: boolean
- **ChatChannel** — `id`: string, `workspaceId`: string, `kind`: string, `name`: string \| null, `topic`: string, `joined`: boolean, `muted`: boolean, `notify`: string, `mutedUntil`: string \| null, `starred`: boolean, `feed`: boolean, `feedProjectId`: string \| null, `feedEvents`: array, `unread`: integer, `mentions`: integer, `memberCount`: integer, `lastMessageAt`: string \| null, `people`: array
- **ChatChannelInput** — `name`: string, `topic?`: string, `private?`: boolean, `feed?`: boolean, `feedProjectId?`: string \| null, `feedEvents?`: array, `memberIds?`: array
- **ChatChannelPatch** — `name?`: string, `topic?`: string, `feed?`: boolean, `feedProjectId?`: string \| null, `feedEvents?`: array
- **ChatDirectInput** — `userIds`: array
- **ChatMembersInput** — `userIds`: array
- **ChatNotifyInput** — `level`: string, `until?`: string
- **ChatReaction** — `key`: string, `count`: integer, `mine`: boolean, `users`: array
- **ChatMessage** — `id`: string, `channelId`: string, `parentId`: string \| null, `author`: object \| null, `body`: string, `event`: object \| null, `meeting`: object \| null, `deleted`: boolean, `mentions`: array, `mentionAll`: boolean, `reactions`: array, `files`: array, `pinned`: boolean, `saved`: boolean, `replyCount`: integer, `replyPeople`: array, `lastReplyAt`: string \| null, `createdAt`: string, `editedAt`: string \| null
- **ChatMessagePage** — `messages`: array, `hasMore`: boolean
- **ChatMessageInput** — `body`: string, `parentId?`: string \| null, `fileIds?`: array
- **ChatFile** — `id`: string, `name`: string, `contentType`: string, `size`: integer, `url`: string, `createdAt`: string
- **ChatEvent** — `kind`: string, `actorId?`: string, `actorName?`: string, `assignees?`: array, `projectId`: string, `projectKey`: string, `projectName`: string, `cardId`: string, `number`: integer, `title`: string, `from?`: string, `to?`: string, `column?`: string, `excerpt?`: string, `changes?`: array
- **ChatHit** — `message`: ChatMessage, `channel`: ChatChannel
- **ChatPresence** — `online`: array, `statuses`: array
- **ChatStatus** — `userId`: string, `kind`: string, `icon`: string \| null, `text`: string, `until`: string \| null
- **ChatStatusInput** — `kind`: string, `icon?`: string \| null, `text?`: string, `until?`: string \| null
- **ChatBodyInput** — `body`: string
