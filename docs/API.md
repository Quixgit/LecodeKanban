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

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/auth/csrf` | public |  | 200 | Issue the CSRF cookie |
| GET | `/auth/providers` | public |  | 200 | Which OAuth providers are configured |
| POST | `/auth/register` | public | RegisterRequest | 201 Session, 409 Error, 422 Error, 429 Error |  |
| POST | `/auth/login` | public | LoginRequest | 200 Session, 401 Error, 423 Error, 429 Error |  |
| POST | `/auth/refresh` | public |  | 200 Session, 401 Error | Rotate the refresh token and issue a new access token |
| POST | `/auth/logout` | public |  | 204 |  |
| GET | `/auth/session` | session |  | 200 Session, 401 Error |  |
| POST | `/auth/verify-email` | public | TokenRequest | 204, 400 Error |  |
| POST | `/auth/verify-email/resend` | session |  | 204, 429 Error |  |
| POST | `/auth/password/forgot` | public | EmailRequest | 204, 429 Error |  |
| POST | `/auth/password/reset` | public | ResetPasswordRequest | 204, 400 Error, 422 Error |  |
| GET | `/auth/oauth/{provider}/start` | public |  | 302, 404 Error |  |
| GET | `/auth/oauth/{provider}/callback` | public |  | 302 |  |

## users

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/users/me` | session |  | 200 |  |
| PATCH | `/users/me` | session | UpdateProfileRequest | 200, 422 Error |  |
| POST | `/users/me/password` | session | ChangePasswordRequest | 204, 401 Error, 422 Error |  |

## workspaces

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/workspaces` | session |  | 200 | Workspaces the caller belongs to (a personal one is created on first call if none) |
| POST | `/workspaces` | session | WorkspaceInput | 201, 422 Error |  |
| GET | `/workspaces/{workspaceId}` | session |  | 200, 404 Error |  |
| PATCH | `/workspaces/{workspaceId}` | session | WorkspaceInput | 200, 403 Error |  |
| DELETE | `/workspaces/{workspaceId}` | session |  | 204, 403 Error |  |
| GET | `/workspaces/{workspaceId}/members` | session |  | 200 |  |
| PATCH | `/workspaces/{workspaceId}/members/{userId}` | session | UpdateMemberRequest | 204, 403 Error, 409 Error |  |
| DELETE | `/workspaces/{workspaceId}/members/{userId}` | session |  | 204, 403 Error, 409 Error | Remove a member (or leave, when userId is the caller) |
| GET | `/workspaces/{workspaceId}/invites` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/invites` | session | CreateInviteRequest | 201, 403 Error, 409 Error |  |
| DELETE | `/workspaces/{workspaceId}/invites/{inviteId}` | session |  | 204, 404 Error |  |
| GET | `/invites/{token}` | public |  | 200, 404 Error |  |
| POST | `/invites/{token}/accept` | session |  | 200, 403 Error, 410 Error |  |

## projects

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/workspaces/{workspaceId}/projects` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/projects` | session | ProjectInput | 201, 409 Error, 422 Error |  |
| GET | `/workspaces/{workspaceId}/projects/summary` | session |  | 200 |  |
| GET | `/projects/{projectId}` | session |  | 200, 404 Error |  |
| PATCH | `/projects/{projectId}` | session | ProjectPatch | 200, 403 Error |  |
| DELETE | `/projects/{projectId}` | session |  | 204, 403 Error |  |

## boards

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/projects/{projectId}/board` | session |  | 200 |  |
| POST | `/projects/{projectId}/board/columns` | session | ColumnInput | 201, 422 Error |  |
| PATCH | `/columns/{columnId}` | session | ColumnPatch | 200, 422 Error |  |
| DELETE | `/columns/{columnId}` | session |  | 204, 409 Error, 422 Error |  |
| POST | `/columns/{columnId}/move` | session | Neighbours | 200 |  |
| GET | `/workspaces/{workspaceId}/views` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/views` | session | SavedViewInput | 201, 422 Error |  |
| PATCH | `/views/{viewId}` | session | SavedViewPatch | 200 |  |
| DELETE | `/views/{viewId}` | session |  | 204 |  |

## cards

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/workspaces/{workspaceId}/cards` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/cards` | session | CardInput | 201, 422 Error |  |
| GET | `/workspaces/{workspaceId}/cards/summary` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/cards/bulk` | session | BulkCardAction | 200 |  |
| GET | `/workspaces/{workspaceId}/cards/stats` | session |  | 200 |  |
| GET | `/cards/{cardId}` | session |  | 200, 404 Error |  |
| PATCH | `/cards/{cardId}` | session | CardPatch | 200, 409 Error |  |
| DELETE | `/cards/{cardId}` | session |  | 204 |  |
| POST | `/cards/{cardId}/move` | session | CardMove | 200, 409 Error |  |
| GET | `/workspaces/{workspaceId}/cards/board` | session |  | 200 |  |
| GET | `/workspaces/{workspaceId}/labels` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/labels` | session | LabelInput | 201, 409 Error |  |
| PATCH | `/labels/{labelId}` | session | LabelPatch | 200 |  |
| DELETE | `/labels/{labelId}` | session |  | 204 |  |
| GET | `/cards/{cardId}/checklist` | session |  | 200 |  |
| POST | `/cards/{cardId}/checklist` | session | ChecklistItemInput | 201 |  |
| PATCH | `/checklist-items/{itemId}` | session | ChecklistItemPatch | 200 |  |
| DELETE | `/checklist-items/{itemId}` | session |  | 204 |  |

## comments

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/cards/{cardId}/comments` | session |  | 200 |  |
| POST | `/cards/{cardId}/comments` | session | CommentInput | 201, 422 Error |  |
| PATCH | `/comments/{commentId}` | session | CommentInput | 200, 403 Error |  |
| DELETE | `/comments/{commentId}` | session |  | 204, 403 Error |  |

## attachments

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/cards/{cardId}/attachments` | session |  | 200 |  |
| POST | `/cards/{cardId}/attachments` | session |  | 201, 413 Error |  |
| DELETE | `/attachments/{attachmentId}` | session |  | 204, 403 Error |  |
| GET | `/attachments/{attachmentId}/content` | session |  | 200 |  |

## time

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/cards/{cardId}/time` | session |  | 200 |  |
| POST | `/cards/{cardId}/time` | session | TimeLogInput | 201, 422 Error |  |
| POST | `/cards/{cardId}/timer` | session |  | 201 |  |
| GET | `/timer` | session |  | 200 |  |
| DELETE | `/time-entries/{entryId}` | session |  | 204, 403 Error |  |
| POST | `/time-entries/{entryId}/stop` | session |  | 200, 409 Error |  |

## activity

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/cards/{cardId}/activity` | session |  | 200 |  |

## realtime

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/workspaces/{workspaceId}/events` | session |  | 200 |  |

## wiki

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/workspaces/{workspaceId}/wiki/spaces` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/wiki/spaces` | session | WikiSpaceInput | 201, 422 Error |  |
| GET | `/workspaces/{workspaceId}/wiki/trash` | session |  | 200 |  |
| GET | `/workspaces/{workspaceId}/wiki/favorites` | session |  | 200 |  |
| GET | `/workspaces/{workspaceId}/wiki/recent` | session |  | 200 |  |
| GET | `/workspaces/{workspaceId}/wiki/shared` | session |  | 200 |  |
| GET | `/workspaces/{workspaceId}/wiki/private` | session |  | 200 |  |
| GET | `/wiki/spaces/{spaceId}` | session |  | 200, 404 Error |  |
| PATCH | `/wiki/spaces/{spaceId}` | session | WikiSpacePatch | 200, 403 Error, 422 Error |  |
| DELETE | `/wiki/spaces/{spaceId}` | session |  | 204, 403 Error |  |
| GET | `/wiki/spaces/{spaceId}/tree` | session |  | 200, 404 Error |  |
| POST | `/wiki/spaces/{spaceId}/nodes` | session | WikiNodeInput | 201, 403 Error, 422 Error |  |
| GET | `/wiki/spaces/{spaceId}/audit` | session |  | 200, 403 Error |  |
| GET | `/wiki/spaces/{spaceId}/access` | session |  | 200 |  |
| PUT | `/wiki/spaces/{spaceId}/visibility` | session | WikiVisibilityInput | 200, 403 Error |  |
| PUT | `/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}` | session | WikiGrantInput | 200, 403 Error, 422 Error |  |
| DELETE | `/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}` | session |  | 204, 403 Error |  |
| GET | `/wiki/nodes/{nodeId}` | session |  | 200, 404 Error |  |
| PATCH | `/wiki/nodes/{nodeId}` | session | WikiNodePatch | 200, 403 Error, 422 Error |  |
| DELETE | `/wiki/nodes/{nodeId}` | session |  | 204, 403 Error |  |
| POST | `/wiki/nodes/{nodeId}/move` | session | WikiMoveInput | 200, 403 Error, 409 Error, 422 Error |  |
| POST | `/wiki/nodes/{nodeId}/restore` | session |  | 200, 409 Error |  |
| DELETE | `/wiki/nodes/{nodeId}/purge` | session |  | 204, 409 Error |  |
| GET | `/wiki/nodes/{nodeId}/content` | session |  | 200, 404 Error |  |
| PUT | `/wiki/nodes/{nodeId}/content` | session | WikiContentInput | 200, 403 Error, 409 Error, 413 Error, 422 Error |  |
| POST | `/wiki/nodes/{nodeId}/files` | session |  | 201, 403 Error, 413 Error |  |
| GET | `/wiki/files/{fileId}/content` | session |  | 200, 404 Error |  |
| GET | `/workspaces/{workspaceId}/wiki/templates` | session |  | 200 |  |
| POST | `/workspaces/{workspaceId}/wiki/templates` | session | WikiTemplateInput | 201, 403 Error, 422 Error |  |
| DELETE | `/workspaces/{workspaceId}/wiki/templates/{templateId}` | session |  | 204, 403 Error |  |
| PUT | `/wiki/nodes/{nodeId}/favorite` | session |  | 204 |  |
| DELETE | `/wiki/nodes/{nodeId}/favorite` | session |  | 204 |  |
| GET | `/wiki/nodes/{nodeId}/access` | session |  | 200 |  |
| PUT | `/wiki/nodes/{nodeId}/visibility` | session | WikiVisibilityInput | 200, 403 Error |  |
| PUT | `/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}` | session | WikiGrantInput | 200, 403 Error, 422 Error |  |
| DELETE | `/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}` | session |  | 204, 403 Error |  |

## system

| Method | Path | Auth | Request | Responses | Summary |
| --- | --- | --- | --- | --- | --- |
| GET | `/i18n/error-codes` | public |  | 200 |  |

## Schemas

- **ErrorResponse** — `error`: object
- **FieldError** — `field`: string, `code`: string, `params?`: object
- **CsrfToken** — `token`: string
- **AuthProviders** — `google`: boolean, `github`: boolean
- **Locale**: `en` | `uk`
- **User** — `id`: string, `email`: string, `name`: string, `locale`: Locale, `avatarUrl`: string \| null, `emailVerified`: boolean, `hasPassword`: boolean, `providers`: array, `createdAt`: string
- **Session** — `user`: User
- **RegisterRequest** — `name`: string, `email`: string, `password`: string, `locale?`: Locale
- **LoginRequest** — `email`: string, `password`: string
- **TokenRequest** — `token`: string
- **EmailRequest** — `email`: string
- **ResetPasswordRequest** — `token`: string, `password`: string
- **ChangePasswordRequest** — `currentPassword?`: string, `newPassword`: string
- **UpdateProfileRequest** — `name?`: string, `locale?`: Locale
- **Role**: `owner` | `admin` | `member` | `viewer`
- **InviteRole**: `admin` | `member` | `viewer`
- **Workspace** — `id`: string, `name`: string, `slug`: string, `role`: Role, `memberCount`: integer, `createdAt`: string
- **WorkspaceInput** — `name`: string
- **MemberUser** — `id`: string, `name`: string, `email`: string, `avatarUrl`: string \| null
- **Member** — `user`: MemberUser, `role`: Role, `joinedAt`: string
- **UpdateMemberRequest** — `role`: Role
- **Invite** — `id`: string, `email`: string, `role`: InviteRole, `expiresAt`: string, `createdAt`: string
- **CreateInviteRequest** — `email`: string, `role`: InviteRole
- **InvitePreview** — `workspaceName`: string, `inviterName`: string \| null, `email`: string, `role`: InviteRole, `expired`: boolean, `accepted`: boolean
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
- **CardBoard** — `items`: array, `truncated`: boolean
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
- **TimeSummary** — `entries`: array, `totalSeconds`: integer
- **TimeLogInput** — `seconds`: integer, `note?`: string, `startedAt?`: string
- **RunningTimer** — `entry?`: TimeEntry
- **ActivityEntry** — `id`: integer, `kind`: string, `data`: object, `actor`: object \| null, `at`: string
- **ActivityPage** — `items`: array, `nextBefore`: integer \| null
- **RealtimeMessage** — `type`: string, `workspaceId`: string, `projectId?`: string, `cardId?`: string, `actorId?`: string
- **CardPage** — `items`: array, `total`: integer, `page`: integer, `pageSize`: integer
- **StatusCounts** — `todo`: integer, `in_progress`: integer, `in_review`: integer, `done`: integer
- **BulkCardAction** — `ids`: array, `action`: string, `status?`: TaskStatus, `priority?`: Priority
- **BulkResult** — `updated`: integer
- **DailyActivity** — `date`: string, `todo`: integer, `in_progress`: integer, `in_review`: integer, `done`: integer
- **ActivityItem** — `id`: integer, `card`: object, `project`: ProjectRef, `actor`: object \| null, `from`: object \| null, `to`: TaskStatus, `at`: string
- **Trend** — `value`: integer, `previous`: integer, `changePct`: number
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
