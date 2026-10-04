package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Device is one place a person is signed in.
type Device struct {
	ID         uuid.UUID
	StartedAt  time.Time
	LastSeenAt time.Time
	UserAgent  string
	IP         string
	Current    bool
}

// Devices lists where the person is signed in, newest activity first; current marks this request's session.
func (s *Service) Devices(ctx context.Context, userID, current uuid.UUID) ([]Device, error) {
	rows, err := s.repo.Sessions(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Device, len(rows))
	for i, r := range rows {
		out[i] = Device{ID: r.ID, StartedAt: r.StartedAt, LastSeenAt: r.LastSeenAt, UserAgent: r.UserAgent, IP: r.IP, Current: r.ID == current}
	}
	return out, nil
}

// SignOutDevice ends one of the person's sessions. Other people's session ids look like missing ones.
func (s *Service) SignOutDevice(ctx context.Context, userID, device uuid.UUID) error {
	ok, err := s.repo.RevokeUserFamily(ctx, userID, device)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.New(domain.ErrSessionNotFound, "session not found")
	}
	return nil
}

// SignOutOtherDevices ends every session except the current one.
func (s *Service) SignOutOtherDevices(ctx context.Context, userID, current uuid.UUID) error {
	return s.repo.RevokeOthersForUser(ctx, userID, current)
}
