// Package domain holds the integrations model: outside accounts a person connects.
package domain

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

var (
	ErrNotConnected  = apperr.Define("integrations.not_connected", http.StatusNotFound)
	ErrNotConfigured = apperr.Define("integrations.not_configured", http.StatusConflict)
	ErrBadState      = apperr.Define("integrations.bad_state", http.StatusBadRequest)
	// ErrReauth means the stored grant no longer works: the person must connect again.
	ErrReauth = errors.New("integrations: the account must be connected again")
)

type Provider string

const GoogleCalendar Provider = "google_calendar"

// Providers lists what can be connected, in display order.
var Providers = []Provider{GoogleCalendar}

func (p Provider) Valid() bool {
	for _, x := range Providers {
		if x == p {
			return true
		}
	}
	return false
}

type Status string

const (
	Connected Status = "connected"
	Errored   Status = "error" // the account needs to be connected again
)

// Allowed reminder lead times, in minutes.
var LeadChoices = []int{5, 10, 15, 30, 60}

func ValidLead(m int) bool {
	for _, x := range LeadChoices {
		if x == m {
			return true
		}
	}
	return false
}

type Integration struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	WorkspaceID  uuid.UUID
	Provider     Provider
	Enabled      bool
	AccountEmail string
	RefreshToken []byte // sealed
	LeadMinutes  int
	NotifyBell   bool
	ChannelID    *uuid.UUID
	Status       Status
	LastError    string
	LastSyncAt   *time.Time
}

// Event is a cached calendar event.
type Event struct {
	ID            uuid.UUID
	IntegrationID uuid.UUID
	RemoteID      string
	Title         string
	StartsAt      time.Time
	EndsAt        time.Time
	AllDay        bool
	Location      string
	Link          string
	JoinURL       string
	Attendees     []string // invited addresses
	NotifiedAt    *time.Time
}

// Open is where "join" leads: the video call when there is one, else the event itself.
func (e Event) Open() string {
	if e.JoinURL != "" {
		return e.JoinURL
	}
	return e.Link
}
