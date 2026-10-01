package realtime

import (
	"bufio"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func quietHub() *Hub { return NewHub("", slog.New(slog.NewTextHandler(io.Discard, nil))) }

func TestDispatchFiltersByWorkspaceAndSignalsOverflow(t *testing.T) {
	h := quietHub()
	a, b := uuid.New(), uuid.New()
	sa, _ := h.subscribe(a)
	sb, _ := h.subscribe(b)
	h.dispatch(Message{Type: "card.moved", WorkspaceID: a})
	if got := <-sa.ch; got.Type != "card.moved" {
		t.Fatalf("got %+v", got)
	}
	select {
	case m := <-sb.ch:
		t.Fatalf("other workspace received %+v", m)
	default:
	}
	for range 70 { // buffer is 64
		h.dispatch(Message{Type: "x", WorkspaceID: a})
	}
	select {
	case <-sa.overflow:
	default:
		t.Fatal("overflow not signalled")
	}
	h.unsubscribe(sa)
	h.unsubscribe(sb)
	if h.Subscribers() != 0 {
		t.Fatal("unsubscribe leaked")
	}
}

func TestHandlerStreamsAndStopsOnClose(t *testing.T) {
	h := quietHub()
	ws := uuid.New()
	deny := errors.New("denied")
	handler := h.Handler(
		func(r *http.Request) (uuid.UUID, error) { return uuid.Parse(r.URL.Query().Get("ws")) },
		func(_ *http.Request, id uuid.UUID) error {
			if id != ws {
				return deny
			}
			return nil
		},
		func(w http.ResponseWriter, _ *http.Request, err error) {
			http.Error(w, err.Error(), http.StatusForbidden)
		},
	)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "?ws=" + uuid.NewString())
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unauthorised stream: %d", resp.StatusCode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"?ws="+ws.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content type %q", ct)
	}
	lines := bufio.NewScanner(resp.Body)
	next := func() string {
		for lines.Scan() {
			if l := lines.Text(); strings.HasPrefix(l, "event:") {
				lines.Scan()
				return l + " " + lines.Text()
			}
		}
		return ""
	}
	if got := next(); !strings.HasPrefix(got, "event: ready") {
		t.Fatalf("first event %q", got)
	}
	for h.Subscribers() == 0 {
		time.Sleep(5 * time.Millisecond)
	}
	h.dispatch(Message{Type: "card.created", WorkspaceID: ws})
	if got := next(); !strings.Contains(got, `"type":"card.created"`) {
		t.Fatalf("change event %q", got)
	}
	h.Close()
	if got := next(); got != "" {
		t.Fatalf("stream must end on close, got %q", got)
	}
}
