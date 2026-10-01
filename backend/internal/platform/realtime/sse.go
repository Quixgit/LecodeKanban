package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// Authorize checks that the request's user may watch the workspace.
type Authorize func(r *http.Request, ws uuid.UUID) error

// heartbeat keeps proxies from closing idle streams.
const heartbeat = 25 * time.Second

// Handler streams the hub's messages for one workspace as SSE ("event: change").
// Besides "change", it emits "ready" once and "resync" when messages may have been missed.
func (h *Hub) Handler(workspace func(*http.Request) (uuid.UUID, error), authorize Authorize, onError func(http.ResponseWriter, *http.Request, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ws, err := workspace(r)
		if err == nil {
			err = authorize(r, ws)
		}
		if err != nil {
			onError(w, r, err)
			return
		}
		sub, err := h.subscribe(ws)
		if err != nil {
			http.Error(w, "shutting down", http.StatusServiceUnavailable)
			return
		}
		defer h.unsubscribe(sub)

		rc := http.NewResponseController(w)
		_ = rc.SetWriteDeadline(time.Time{}) // streams outlive the server's WriteTimeout
		hd := w.Header()
		hd.Set("Content-Type", "text/event-stream")
		hd.Set("Cache-Control", "no-store")
		hd.Set("X-Accel-Buffering", "no") // nginx: do not buffer
		w.WriteHeader(http.StatusOK)

		send := func(event string, data any) bool {
			b, _ := json.Marshal(data)
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b); err != nil {
				return false
			}
			return rc.Flush() == nil
		}
		if !send("ready", map[string]any{"retry": 3000}) {
			return
		}
		tick := time.NewTicker(heartbeat)
		defer tick.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case <-h.done:
				return
			case m := <-sub.ch:
				if !send("change", m) {
					return
				}
			case <-sub.overflow:
				if !send("resync", map[string]any{}) {
					return
				}
			case <-tick.C:
				if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil || rc.Flush() != nil {
					return
				}
			}
		}
	}
}
