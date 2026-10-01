package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
	"time"
)

// signUp registers a user and returns the client and their personal workspace id.
func signUp(t *testing.T, base, name, email string) (*client, string) {
	t.Helper()
	c := newClient(t, base)
	c.do("GET", "/api/v1/auth/csrf", nil, nil)
	if code := c.do("POST", "/api/v1/auth/register", map[string]any{"name": name, "email": email, "password": "Kanban-Board-2026"}, nil); code != 201 {
		t.Fatalf("register %s: %d", email, code)
	}
	var spaces []struct {
		ID string `json:"id"`
	}
	c.do("GET", "/api/v1/workspaces", nil, &spaces)
	return c, spaces[0].ID
}

// stream opens the workspace event stream and delivers "event data" lines on the channel.
func stream(t *testing.T, c *client, ws string) <-chan string {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/api/v1/workspaces/"+ws+"/events", nil)
	req.Header.Set("Accept", "text/event-stream")
	res, err := c.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 || res.Header.Get("X-Accel-Buffering") != "no" {
		t.Fatalf("stream: %d %v", res.StatusCode, res.Header)
	}
	out := make(chan string, 32)
	go func() {
		defer func() { _ = res.Body.Close() }()
		sc := bufio.NewScanner(res.Body)
		event := ""
		for sc.Scan() {
			line := sc.Text()
			switch {
			case strings.HasPrefix(line, "event: "):
				event = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "data: "):
				out <- event + " " + strings.TrimPrefix(line, "data: ")
			}
		}
		close(out)
	}()
	return out
}

func expectEvent(t *testing.T, ch <-chan string, substr string) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case ev, ok := <-ch:
			if !ok {
				t.Fatalf("stream closed waiting for %q", substr)
			}
			if strings.Contains(ev, substr) {
				return
			}
		case <-deadline:
			t.Fatalf("no event containing %q", substr)
		}
	}
}

func TestEndToEndKanbanRealtimeAndFiles(t *testing.T) {
	srv := newServer(t)
	peter, ws := signUp(t, srv.URL, "Peter", "peter@example.com")
	stranger, _ := signUp(t, srv.URL, "Eve", "eve@example.com")

	var e errBody
	if code := stranger.do("GET", "/api/v1/workspaces/"+ws+"/events", nil, &e); code != 404 {
		t.Fatalf("strangers must not stream another workspace: %d %s", code, e.Error.Code)
	}
	events := stream(t, peter, ws)
	expectEvent(t, events, "ready ")

	var project struct {
		ID string `json:"id"`
	}
	if code := peter.do("POST", "/api/v1/workspaces/"+ws+"/projects", map[string]any{"name": "Kanban"}, &project); code != 201 {
		t.Fatalf("project: %d", code)
	}
	var label struct {
		ID string `json:"id"`
	}
	peter.do("POST", "/api/v1/workspaces/"+ws+"/labels", map[string]any{"name": "Bug", "tone": "red"}, &label)
	var card struct {
		ID        string `json:"id"`
		Progress  int    `json:"progress"`
		Labels    []any  `json:"labels"`
		Checklist struct {
			Total int `json:"total"`
		} `json:"checklist"`
	}
	if code := peter.do("POST", "/api/v1/workspaces/"+ws+"/cards", map[string]any{
		"projectId": project.ID, "title": "Live", "status": "in_progress", "labelIds": []string{label.ID},
	}, &card); code != 201 || card.Progress != 40 || len(card.Labels) != 1 {
		t.Fatalf("card: %d %+v", code, card)
	}
	// The hint travels API → Postgres NOTIFY → hub → SSE.
	expectEvent(t, events, `"type":"card.created"`)

	var board struct {
		Items     []map[string]any `json:"items"`
		Truncated bool             `json:"truncated"`
	}
	if code := peter.do("GET", "/api/v1/workspaces/"+ws+"/cards/board?labelId="+label.ID, nil, &board); code != 200 || len(board.Items) != 1 {
		t.Fatalf("board: %d %+v", code, board)
	}
	if code := peter.do("POST", "/api/v1/cards/"+card.ID+"/checklist", map[string]any{"text": "Write tests"}, nil); code != 201 {
		t.Fatalf("checklist: %d", code)
	}
	expectEvent(t, events, `"type":"checklist.changed"`)
	if code := peter.do("POST", "/api/v1/cards/"+card.ID+"/comments", map[string]any{"body": "Looks good"}, nil); code != 201 {
		t.Fatalf("comment: %d", code)
	}

	// Multipart upload → download with safe headers.
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "notes.html")
	_, _ = fw.Write([]byte("<html><script>alert(1)</script></html>"))
	_ = mw.Close()
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/cards/"+card.ID+"/attachments", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-CSRF-Token", peter.csrf())
	res, err := peter.http.Do(req)
	if err != nil || res.StatusCode != 201 {
		t.Fatalf("upload: %v %d", err, res.StatusCode)
	}
	var att struct {
		ID          string `json:"id"`
		Previewable bool   `json:"previewable"`
	}
	_ = jsonDecode(res.Body, &att)
	_ = res.Body.Close()
	if att.Previewable {
		t.Fatal("html must not be previewable")
	}
	res, err = peter.http.Get(srv.URL + "/api/v1/attachments/" + att.ID + "/content?inline=true")
	if err != nil {
		t.Fatal(err)
	}
	got, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	h := res.Header
	if res.StatusCode != 200 || !strings.HasPrefix(h.Get("Content-Disposition"), "attachment") ||
		h.Get("Content-Type") != "application/octet-stream" || !strings.Contains(h.Get("Content-Security-Policy"), "sandbox") ||
		!strings.Contains(string(got), "<script>") {
		t.Fatalf("download: %d %v", res.StatusCode, h)
	}
	if res, _ := stranger.http.Get(srv.URL + "/api/v1/attachments/" + att.ID + "/content"); res.StatusCode != 404 {
		t.Fatalf("strangers must not download: %d", res.StatusCode)
	}

	var feed struct {
		Items []struct {
			Kind string `json:"kind"`
		} `json:"items"`
	}
	if code := peter.do("GET", "/api/v1/cards/"+card.ID+"/activity", nil, &feed); code != 200 || len(feed.Items) != 4 ||
		feed.Items[0].Kind != "attachment.added" || feed.Items[3].Kind != "card.created" {
		t.Fatalf("activity: %d %+v", code, feed.Items)
	}
}

func jsonDecode(r io.Reader, out any) error { return json.NewDecoder(r).Decode(out) }
