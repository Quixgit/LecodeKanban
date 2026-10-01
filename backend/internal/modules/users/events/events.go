// Package events declares events published by the users module.
package events

import "github.com/google/uuid"

// ProfileUpdated fires after a user changes name or language.
type ProfileUpdated struct {
	UserID uuid.UUID
}

func (ProfileUpdated) EventName() string { return "users.profile_updated" }
