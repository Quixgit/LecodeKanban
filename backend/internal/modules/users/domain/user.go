// Package domain holds the users module's entities and errors.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Locale string

const (
	LocaleEN Locale = "en"
	LocaleUK Locale = "uk"
)

func (l Locale) Valid() bool { return l == LocaleEN || l == LocaleUK }

// User is the public profile.
type User struct {
	ID              uuid.UUID
	Email           string
	Name            string
	Locale          Locale
	AvatarURL       *string
	EmailVerifiedAt *time.Time
	HasPassword     bool
	CreatedAt       time.Time
}

func (u User) EmailVerified() bool { return u.EmailVerifiedAt != nil }

// Credentials are the sensitive login fields, only exposed to the auth module.
type Credentials struct {
	User             User
	PasswordHash     *string
	FailedLoginCount int
	LockedUntil      *time.Time
}

// LockedAt reports whether the account is locked at time now.
func (c Credentials) LockedAt(now time.Time) bool {
	return c.LockedUntil != nil && c.LockedUntil.After(now)
}

// NewUser is the input for creating a user.
type NewUser struct {
	Email        string
	Name         string
	PasswordHash *string
	Locale       Locale
	Verified     bool
	AvatarURL    *string
}

// ProfilePatch updates mutable profile fields; nil means unchanged.
type ProfilePatch struct {
	Name   *string
	Locale *Locale
}

var (
	ErrNotFound   = apperr.Define("users.not_found", http.StatusNotFound)
	ErrEmailTaken = apperr.Define("users.email_taken", http.StatusConflict)
)
