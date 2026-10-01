// Package ratelimit provides an in-memory keyed token-bucket limiter.
//
// It is per-process; when the API runs with multiple replicas, swap in a
// Redis-backed implementation of Limiter (see ADR 0006).
package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Limiter interface {
	// Allow consumes one token for key; when denied it returns the wait until the next token.
	Allow(key string) (bool, time.Duration)
}

type entry struct {
	lim  *rate.Limiter
	seen time.Time
}

type Memory struct {
	mu      sync.Mutex
	every   rate.Limit
	burst   int
	entries map[string]*entry
	now     func() time.Time
}

// NewMemory allows `burst` events immediately and then one per `per/burst`.
func NewMemory(burst int, per time.Duration) *Memory {
	m := &Memory{
		every: rate.Every(per / time.Duration(burst)), burst: burst,
		entries: map[string]*entry{}, now: time.Now,
	}
	return m
}

func (m *Memory) Allow(key string) (bool, time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	e, ok := m.entries[key]
	if !ok {
		if len(m.entries) > 50_000 {
			m.sweep(now)
		}
		e = &entry{lim: rate.NewLimiter(m.every, m.burst)}
		m.entries[key] = e
	}
	e.seen = now
	r := e.lim.ReserveN(now, 1)
	if d := r.DelayFrom(now); d > 0 {
		r.CancelAt(now)
		return false, d
	}
	return true, 0
}

// sweep drops buckets idle for 10 minutes (they would be full again anyway).
func (m *Memory) sweep(now time.Time) {
	for k, e := range m.entries {
		if now.Sub(e.seen) > 10*time.Minute {
			delete(m.entries, k)
		}
	}
}
