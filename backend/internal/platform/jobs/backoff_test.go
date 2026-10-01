package jobs

import (
	"errors"
	"testing"
	"time"
)

func TestBackoff(t *testing.T) {
	for attempt, base := range map[int]time.Duration{1: 2 * time.Second, 3: 8 * time.Second, 30: time.Hour} {
		for range 50 {
			d := Backoff(attempt)
			if d < time.Duration(float64(base)*0.8) || d > time.Duration(float64(base)*1.2) {
				t.Fatalf("attempt %d: %v outside ±20%% of %v", attempt, d, base)
			}
		}
	}
}

func TestPermanentUnwraps(t *testing.T) {
	inner := errors.New("bad payload")
	var p Permanent
	if !errors.As(Permanent{inner}, &p) || !errors.Is(Permanent{inner}, inner) {
		t.Fatal("Permanent must wrap its cause")
	}
}
