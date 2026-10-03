package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// CanPost reports whether the person may write in the channel, and which workspace it belongs to.
func (s *Service) CanPost(ctx context.Context, user, channel uuid.UUID) (uuid.UUID, error) {
	ch, _, err := s.access(ctx, user, channel, true)
	if err != nil {
		return uuid.Nil, err
	}
	return ch.WorkspaceID, nil
}

// MeetingNotice is a calendar reminder as a chat message.
type MeetingNotice struct {
	Title       string
	StartsAt    time.Time
	EndsAt      time.Time
	Location    string
	Link        string
	LeadMinutes int
	Attendees   int
}

type meetingPayload struct {
	Kind        string    `json:"kind"`
	Title       string    `json:"title"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
	Location    string    `json:"location,omitempty"`
	Link        string    `json:"link,omitempty"`
	LeadMinutes int       `json:"leadMinutes"`
	Attendees   int       `json:"attendees"`
}

// PostMeeting writes a meeting reminder into a channel as the system, like a calendar bot would.
func (s *Service) PostMeeting(ctx context.Context, ws, channel uuid.UUID, m MeetingNotice) error {
	ch, err := s.repo.Channel(ctx, channel)
	if err != nil {
		return err
	}
	if ch.WorkspaceID != ws {
		return apperr.New(domain.ErrNotFound, "not found")
	}
	payload, err := json.Marshal(meetingPayload{Kind: "meeting", Title: m.Title, StartsAt: m.StartsAt, EndsAt: m.EndsAt,
		Location: m.Location, Link: m.Link, LeadMinutes: m.LeadMinutes, Attendees: m.Attendees})
	if err != nil {
		return err
	}
	msg, err := s.repo.InsertEvent(ctx, ch.ID, nil, "meeting "+m.Title, payload)
	if err != nil {
		return err
	}
	_ = s.repo.TouchChannel(ctx, ch.ID, msg.CreatedAt)
	s.hint(ctx, "chat.message", ws, uuid.Nil, ch.ID, &msg.ID)
	return nil
}
