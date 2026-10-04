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
	JobTitle        string
	Phone           string
	Location        string
	Timezone        string // IANA name, empty when not set
	Bio             string
	Pronouns        string
	LinkedIn        string // full https://www.linkedin.com/in/... address, empty when not set
	Telegram        string // username without the @
	Website         string
	WorkStart       string // HH:MM, empty when not set
	WorkEnd         string
	Skills          []string
	CoverPreset     string // one of CoverPresets, empty when none
	CoverURL        *string
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
	Name        *string
	Locale      *Locale
	JobTitle    *string
	Phone       *string
	Location    *string
	Timezone    *string
	Bio         *string
	Pronouns    *string
	LinkedIn    *string
	Telegram    *string
	Website     *string
	WorkStart   *string
	WorkEnd     *string
	Skills      *[]string
	CoverPreset *string
}

// CoverPresets are the ready-made profile backgrounds; the web client draws them from design tokens.
var CoverPresets = []string{"aurora", "ocean", "sunset", "forest", "lavender", "slate", "dawn", "mint"}

var (
	ErrNotFound   = apperr.Define("users.not_found", http.StatusNotFound)
	ErrEmailTaken = apperr.Define("users.email_taken", http.StatusConflict)
	// ErrBadAvatar: the file is not a PNG, JPEG, WebP or GIF picture.
	ErrBadAvatar = apperr.Define("users.bad_avatar", http.StatusUnprocessableEntity)
	// ErrAvatarTooLarge: the picture is over the size limit.
	ErrAvatarTooLarge = apperr.Define("users.avatar_too_large", http.StatusRequestEntityTooLarge)
	// ErrBadCover: the file is not a PNG, JPEG, WebP or GIF picture.
	ErrBadCover = apperr.Define("users.bad_cover", http.StatusUnprocessableEntity)
	// ErrCoverTooLarge: the cover picture is over the size limit.
	ErrCoverTooLarge = apperr.Define("users.cover_too_large", http.StatusRequestEntityTooLarge)
)
