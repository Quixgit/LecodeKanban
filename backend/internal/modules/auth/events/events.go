// Package events declares events published by the auth module.
package events

import "github.com/google/uuid"

// UserRegistered fires once per new account (password or OAuth sign-up).
type UserRegistered struct {
	UserID uuid.UUID
	Email  string
	Name   string
	Locale string
	Via    string // "password" | "google" | "github"
}

func (UserRegistered) EventName() string { return "auth.user_registered" }

// EmailVerified fires when a user proves ownership of their address.
type EmailVerified struct {
	UserID uuid.UUID
	Email  string
}

func (EmailVerified) EventName() string { return "auth.email_verified" }

// PasswordChanged fires after a reset or change; other sessions have been revoked.
type PasswordChanged struct{ UserID uuid.UUID }

func (PasswordChanged) EventName() string { return "auth.password_changed" }
