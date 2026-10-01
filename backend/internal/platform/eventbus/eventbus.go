// Package eventbus is a small synchronous in-process pub/sub used for
// cross-module side effects without import cycles: publishers depend only on
// event types, subscribers register in the composition root.
package eventbus

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

// Event is implemented by every published value; Name is a stable topic like "users.registered".
type Event interface{ EventName() string }

type handler func(context.Context, Event) error

type Bus struct {
	mu       sync.RWMutex
	handlers map[string][]handler
}

func New() *Bus { return &Bus{handlers: map[string][]handler{}} }

// Subscribe registers a typed handler for events of type E.
func Subscribe[E Event](b *Bus, fn func(context.Context, E) error) {
	var zero E
	name := zero.EventName()
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[name] = append(b.handlers[name], func(ctx context.Context, e Event) error {
		typed, ok := e.(E)
		if !ok {
			return fmt.Errorf("eventbus: %s delivered %T", name, e)
		}
		return fn(ctx, typed)
	})
}

// Publish delivers e to every subscriber in registration order. All handlers run
// even if one fails; failures are logged and joined into the returned error.
func (b *Bus) Publish(ctx context.Context, e Event) error {
	b.mu.RLock()
	hs := append([]handler(nil), b.handlers[e.EventName()]...)
	b.mu.RUnlock()

	var errs []error
	for _, h := range hs {
		if err := safeCall(ctx, h, e); err != nil {
			logger.From(ctx).Error("event handler failed", slog.String("event", e.EventName()), slog.Any("err", err))
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func safeCall(ctx context.Context, h handler, e Event) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("eventbus: handler panic: %v", r)
		}
	}()
	return h(ctx, e)
}
