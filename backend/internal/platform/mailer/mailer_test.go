package mailer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
)

type fakeSender struct{ got []Message }

func (f *fakeSender) Send(_ context.Context, m Message) error { f.got = append(f.got, m); return nil }

func TestJobHandler(t *testing.T) {
	f := &fakeSender{}
	h := JobHandler(f)
	body, _ := json.Marshal(Message{To: "a@b.co", Subject: "Hi"})
	if err := h(context.Background(), body); err != nil || len(f.got) != 1 || f.got[0].To != "a@b.co" {
		t.Fatalf("handler: %v %v", err, f.got)
	}
	var perm jobs.Permanent
	if err := h(context.Background(), json.RawMessage(`{bad`)); !errors.As(err, &perm) {
		t.Fatalf("malformed payload must be permanent, got %v", err)
	}
}

func TestActionRenderEscapes(t *testing.T) {
	html, text, err := Action{
		Lang: "uk", Heading: "Підтвердіть <email>", Paragraphs: []string{"Привіт"},
		ButtonLabel: "Go", ButtonURL: "https://x.test/verify?token=abc", Footer: "f",
	}.Render()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(html, "<email>") || !strings.Contains(html, "&lt;email&gt;") {
		t.Fatal("heading must be HTML-escaped")
	}
	if !strings.Contains(text, "https://x.test/verify?token=abc") || !strings.Contains(html, `lang="uk"`) {
		t.Fatal("missing content")
	}
}
