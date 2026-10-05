package domain_test

import (
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/domain"
)

func at(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestNextDaily(t *testing.T) {
	r := domain.Recurrence{Freq: domain.Daily, Hour: 9, Timezone: "UTC"}
	if got := r.Next(at("2026-10-05T08:00:00Z")); !got.Equal(at("2026-10-05T09:00:00Z")) {
		t.Fatalf("before the hour: %v", got)
	}
	if got := r.Next(at("2026-10-05T09:00:00Z")); !got.Equal(at("2026-10-06T09:00:00Z")) {
		t.Fatalf("exactly at the hour moves on: %v", got)
	}
}

func TestNextWeekly(t *testing.T) {
	// Monday and Thursday; 2026-10-05 is a Monday.
	r := domain.Recurrence{Freq: domain.Weekly, Weekdays: []int{1, 4}, Hour: 10, Timezone: "UTC"}
	if got := r.Next(at("2026-10-05T11:00:00Z")); !got.Equal(at("2026-10-08T10:00:00Z")) {
		t.Fatalf("Monday after the hour → Thursday: %v", got)
	}
	if got := r.Next(at("2026-10-08T11:00:00Z")); !got.Equal(at("2026-10-12T10:00:00Z")) {
		t.Fatalf("Thursday after the hour → next Monday: %v", got)
	}
	if got := (domain.Recurrence{Freq: domain.Weekly, Hour: 9, Timezone: "UTC"}).Next(at("2026-10-05T00:00:00Z")); !got.IsZero() {
		t.Fatalf("no weekdays never fires: %v", got)
	}
}

func TestNextMonthlyClampsToTheLastDay(t *testing.T) {
	r := domain.Recurrence{Freq: domain.Monthly, MonthDay: 31, Hour: 9, Timezone: "UTC"}
	if got := r.Next(at("2026-01-31T10:00:00Z")); !got.Equal(at("2026-02-28T09:00:00Z")) {
		t.Fatalf("31st in February: %v", got)
	}
	if got := r.Next(at("2028-01-31T10:00:00Z")); !got.Equal(at("2028-02-29T09:00:00Z")) {
		t.Fatalf("leap year: %v", got)
	}
}

func TestNextUsesTheLocalCalendar(t *testing.T) {
	// 09:00 in Kyiv is 06:00 UTC in summer (UTC+3) and 07:00 UTC in winter (UTC+2).
	r := domain.Recurrence{Freq: domain.Daily, Hour: 9, Timezone: "Europe/Kyiv"}
	if got := r.Next(at("2026-07-01T00:00:00Z")); !got.Equal(at("2026-07-01T06:00:00Z")) {
		t.Fatalf("summer: %v", got)
	}
	if got := r.Next(at("2026-12-01T00:00:00Z")); !got.Equal(at("2026-12-01T07:00:00Z")) {
		t.Fatalf("winter: %v", got)
	}
	// Across the autumn change (2026-10-25) the local hour stays 09:00.
	if got := r.Next(at("2026-10-25T05:00:00Z")); !got.Equal(at("2026-10-25T07:00:00Z")) {
		t.Fatalf("change day: %v", got)
	}
	if got := (domain.Recurrence{Freq: domain.Daily, Hour: 9, Timezone: "Mars/Olympus"}).Next(at("2026-10-05T00:00:00Z")); !got.IsZero() {
		t.Fatalf("unknown zone: %v", got)
	}
}
