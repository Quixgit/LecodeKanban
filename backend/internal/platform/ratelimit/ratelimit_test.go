package ratelimit

import (
	"testing"
	"time"
)

func TestMemoryLimiter(t *testing.T) {
	now := time.Unix(0, 0)
	m := NewMemory(3, time.Minute)
	m.now = func() time.Time { return now }

	for i := range 3 {
		if ok, _ := m.Allow("ip"); !ok {
			t.Fatalf("request %d should pass", i)
		}
	}
	ok, wait := m.Allow("ip")
	if ok || wait <= 0 || wait > 20*time.Second {
		t.Fatalf("4th request should be denied with wait ~20s, got ok=%v wait=%v", ok, wait)
	}
	if ok, _ := m.Allow("other"); !ok {
		t.Fatal("keys are independent")
	}
	now = now.Add(21 * time.Second)
	if ok, _ := m.Allow("ip"); !ok {
		t.Fatal("token should refill")
	}
}
