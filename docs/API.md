# LecodeKanban API — v0.2.0

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
