// Package domain holds auth entities and error codes.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Session is the result of a successful authentication.
type Session struct {
	UserID       uuid.UUID
	FamilyID     uuid.UUID
	AccessToken  string
	AccessExp    time.Time
	RefreshToken string // empty when an existing refresh cookie must be kept (benign concurrent refresh)
	RefreshExp   time.Time
}

// Client describes the device a session was created from.
type Client struct {
	IP        string
	UserAgent string
}

// ProviderProfile is the normalised identity returned by an OAuth provider.
type ProviderProfile struct {
	Provider      string
	ID            string
	Email         string
	EmailVerified bool
	Name          string
	AvatarURL     string
}

const (
	PurposeVerifyEmail   = "verify_email"
	PurposeResetPassword = "reset_password"
)

var (
	ErrInvalidCredentials    = apperr.Define("auth.invalid_credentials", http.StatusUnauthorized)
	ErrAccountLocked         = apperr.Define("auth.account_locked", http.StatusLocked)
	ErrSessionExpired        = apperr.Define("auth.session_expired", http.StatusUnauthorized)
	ErrSessionNotFound       = apperr.Define("auth.session_not_found", http.StatusNotFound)
	ErrTokenInvalid          = apperr.Define("auth.token_invalid", http.StatusBadRequest)
	ErrCurrentPassword       = apperr.Define("auth.current_password_incorrect", http.StatusUnprocessableEntity)
	ErrProviderNotConfigured = apperr.Define("auth.provider_not_configured", http.StatusNotFound)
	ErrOAuthFailed           = apperr.Define("auth.oauth_failed", http.StatusBadRequest)
	ErrOAuthEmailUnverified  = apperr.Define("auth.oauth_email_unverified", http.StatusBadRequest)
	ErrOAuthAccountConflict  = apperr.Define("auth.oauth_account_conflict", http.StatusConflict)
)
