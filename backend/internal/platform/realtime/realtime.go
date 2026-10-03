// Package realtime fans small change notifications out to browsers over Server-Sent Events.
//
// Any process (API or worker) publishes with Postgres NOTIFY; every API instance LISTENs on a
// dedicated connection and forwards messages to the SSE streams of that workspace. Messages are
// hints ("card X changed"), never data: clients refetch through the authorised REST API.
package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const channel = "lk_realtime"

// Message is one change hint. Type is a stable topic like "card.moved".
type Message struct {
	Type        string     `json:"type"`
	WorkspaceID uuid.UUID  `json:"workspaceId"`
	ProjectID   *uuid.UUID `json:"projectId,omitempty"`
	CardID      *uuid.UUID `json:"cardId,omitempty"`
	// ChannelID and MessageID are set by chat hints; clients refetch through the authorised API.
	ChannelID *uuid.UUID `json:"channelId,omitempty"`
	MessageID *uuid.UUID `json:"messageId,omitempty"`
	ActorID   *uuid.UUID `json:"actorId,omitempty"`
}

// Publisher sends messages through Postgres so every API instance receives them.
type Publisher struct {
	pool *pgxpool.Pool
	log  *slog.Logger
}

func NewPublisher(pool *pgxpool.Pool, log *slog.Logger) *Publisher {
	return &Publisher{pool: pool, log: log}
}

// Publish is best-effort: a lost hint only delays a refresh, so errors are logged, not returned.
func (p *Publisher) Publish(ctx context.Context, m Message) {
	b, err := json.Marshal(m)
	if err == nil {
		_, err = p.pool.Exec(ctx, "SELECT pg_notify($1, $2)", channel, string(b))
	}
	if err != nil {
		p.log.Warn("realtime publish failed", slog.String("type", m.Type), slog.Any("err", err))
	}
}

// subscriber is one SSE stream; overflow is set when its buffer filled up and messages were dropped.
type subscriber struct {
	ws       uuid.UUID
	ch       chan Message
	overflow chan struct{}
}

// Hub receives NOTIFYs and dispatches them to subscribers of the message's workspace.
type Hub struct {
	url    string
	log    *slog.Logger
	mu     sync.Mutex
	subs   map[*subscriber]struct{}
	closed bool
	done   chan struct{}
}

func NewHub(databaseURL string, log *slog.Logger) *Hub {
	return &Hub{url: databaseURL, log: log, subs: map[*subscriber]struct{}{}, done: make(chan struct{})}
}

// Run listens until ctx ends, reconnecting with capped exponential backoff.
func (h *Hub) Run(ctx context.Context) {
	backoff := time.Second
	for ctx.Err() == nil {
		err := h.listen(ctx)
		if ctx.Err() != nil {
			return
		}
		h.log.Warn("realtime listener disconnected", slog.Any("err", err), slog.Duration("retry_in", backoff))
		h.broadcastResync()
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, 30*time.Second)
	}
}

func (h *Hub) listen(ctx context.Context) error {
	conn, err := pgx.Connect(ctx, h.url)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close(context.Background()) }()
	if _, err := conn.Exec(ctx, "LISTEN "+channel); err != nil {
		return err
	}
	h.log.Info("realtime listener connected")
	for {
		n, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var m Message
		if err := json.Unmarshal([]byte(n.Payload), &m); err != nil {
			h.log.Warn("realtime: bad payload", slog.Any("err", err))
			continue
		}
		h.dispatch(m)
	}
}

func (h *Hub) dispatch(m Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for s := range h.subs {
		if s.ws != m.WorkspaceID {
			continue
		}
		select {
		case s.ch <- m:
		default:
			select {
			case s.overflow <- struct{}{}:
			default:
			}
		}
	}
}

// broadcastResync tells every client it may have missed messages (listener reconnect).
func (h *Hub) broadcastResync() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for s := range h.subs {
		select {
		case s.overflow <- struct{}{}:
		default:
		}
	}
}

var errClosed = errors.New("realtime: hub closed")

func (h *Hub) subscribe(ws uuid.UUID) (*subscriber, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return nil, errClosed
	}
	s := &subscriber{ws: ws, ch: make(chan Message, 64), overflow: make(chan struct{}, 1)}
	h.subs[s] = struct{}{}
	return s, nil
}

func (h *Hub) unsubscribe(s *subscriber) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs, s)
}

// Close ends every stream (call when the HTTP server starts shutting down).
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.closed {
		h.closed = true
		close(h.done)
	}
}

// Subscribers reports open streams (metrics / tests).
func (h *Hub) Subscribers() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs)
}
