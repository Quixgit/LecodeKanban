package google_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/google"
)

const events = `{"items":[
 {"id":"a","status":"confirmed","summary":"Stand-up","htmlLink":"https://calendar.test/a","hangoutLink":"https://meet.test/a",
  "start":{"dateTime":"2026-10-05T11:00:00+02:00"},"end":{"dateTime":"2026-10-05T11:15:00+02:00"},
  "attendees":[{"email":"Anna@Example.com","self":true,"responseStatus":"accepted"},{"email":"room@resource.test","resource":true},{"email":"ben@example.com"}]},
 {"id":"b","status":"confirmed","summary":"Zoom call","htmlLink":"https://calendar.test/b",
  "conferenceData":{"entryPoints":[{"entryPointType":"phone","uri":"tel:123"},{"entryPointType":"video","uri":"https://zoom.test/b"}]},
  "start":{"dateTime":"2026-10-05T12:00:00Z"},"end":{"dateTime":"2026-10-05T13:00:00Z"}},
 {"id":"c","status":"cancelled","summary":"Gone","start":{"dateTime":"2026-10-05T12:00:00Z"},"end":{"dateTime":"2026-10-05T13:00:00Z"}},
 {"id":"d","status":"confirmed","summary":"Declined","start":{"dateTime":"2026-10-05T12:00:00Z"},"end":{"dateTime":"2026-10-05T13:00:00Z"},
  "attendees":[{"email":"anna@example.com","self":true,"responseStatus":"declined"}]},
 {"id":"e","status":"confirmed","summary":"Holiday","start":{"date":"2026-10-06"},"end":{"date":"2026-10-07"}},
 {"id":"f","status":"confirmed","start":{"dateTime":"2026-10-05T14:00:00Z"},"end":{"dateTime":"2026-10-05T14:30:00Z"}}
]}`

func stand(t *testing.T, revoked bool) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "application/json")
		if revoked {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
			return
		}
		if r.Form.Get("grant_type") == "authorization_code" && r.Form.Get("code") == "good" {
			_, _ = w.Write([]byte(`{"access_token":"at","refresh_token":"rt","expires_in":3600,"token_type":"Bearer"}`))
			return
		}
		if r.Form.Get("grant_type") == "refresh_token" && r.Form.Get("refresh_token") == "rt" {
			_, _ = w.Write([]byte(`{"access_token":"at2","expires_in":3600,"token_type":"Bearer"}`))
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_request"}`))
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer at" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"email":"anna@example.com"}`))
	})
	mux.HandleFunc("/calendar/v3/calendars/primary/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer at2" || r.URL.Query().Get("singleEvents") != "true" || r.URL.Query().Get("timeMin") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(events))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func client(srv *httptest.Server) *google.Client {
	return google.New("id", "secret", google.Endpoints{Auth: srv.URL + "/auth", Token: srv.URL + "/token",
		Userinfo: srv.URL + "/userinfo", API: srv.URL})
}

func TestAuthURLAsksForOfflineReadOnlyAccess(t *testing.T) {
	c := google.New("id", "secret", google.Endpoints{})
	u := c.AuthURL("st", "http://app/cb")
	for _, want := range []string{"access_type=offline", "prompt=consent", "state=st", "calendar.events.readonly", "client_id=id"} {
		if !strings.Contains(u, want) {
			t.Errorf("%q missing from %s", want, u)
		}
	}
	if strings.Contains(u, "calendar.readonly") || strings.Contains(u, "auth%2Fcalendar&") {
		t.Errorf("asked for more than read-only events: %s", u)
	}
	if !c.Configured() || google.New("", "", google.Endpoints{}).Configured() {
		t.Error("Configured follows the client id")
	}
}

func TestExchangeAndEvents(t *testing.T) {
	srv := stand(t, false)
	c := client(srv)
	ctx := context.Background()
	token, email, err := c.Exchange(ctx, "good", "http://app/cb")
	if err != nil || token != "rt" || email != "anna@example.com" {
		t.Fatalf("exchange: %q %q %v", token, email, err)
	}
	if _, _, err := c.Exchange(ctx, "bad", "http://app/cb"); err == nil {
		t.Fatal("a bad code was accepted")
	}

	got, err := c.Events(ctx, "rt", time.Now(), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	// Cancelled and declined events are dropped; the others keep their video link.
	titles := []string{}
	for _, e := range got {
		titles = append(titles, e.Title)
	}
	if strings.Join(titles, ",") != "Stand-up,Zoom call,Holiday,(no title)" {
		t.Fatalf("events: %v", titles)
	}
	s := got[0]
	if s.JoinURL != "https://meet.test/a" || s.Link != "https://calendar.test/a" || s.StartsAt.UTC().Hour() != 9 ||
		strings.Join(s.Attendees, ",") != "anna@example.com,ben@example.com" {
		t.Fatalf("stand-up: %+v", s)
	}
	if got[1].JoinURL != "https://zoom.test/b" {
		t.Fatalf("video entry point: %+v", got[1])
	}
	if !got[2].AllDay {
		t.Fatalf("holiday should be all-day: %+v", got[2])
	}
}

func TestRevokedGrantAsksToReconnect(t *testing.T) {
	c := client(stand(t, true))
	_, err := c.Events(context.Background(), "rt", time.Now(), time.Now().Add(time.Hour))
	if !errors.Is(err, domain.ErrReauth) {
		t.Fatalf("want reauth, got %v", err)
	}
}
