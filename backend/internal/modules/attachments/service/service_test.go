package service_test

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

// png is a minimal PNG header: enough for content sniffing.
var png = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

func TestSanitizeName(t *testing.T) {
	cases := map[string]string{
		"report.pdf":             "report.pdf",
		"../../etc/passwd":       "passwd",
		`C:\Users\me\photo.jpg`:  "photo.jpg",
		"bad\x00\"name\n.txt":    "badname.txt",
		"   ":                    "file",
		strings.Repeat("я", 200): strings.Repeat("я", 127),
	}
	for in, want := range cases {
		if got := service.SanitizeName(in); got != want {
			t.Errorf("SanitizeName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAttachmentsLifecycle(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	other := e.User("Other member", "x@example.com")
	viewer := e.User("Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, other: wsdomain.RoleMember,
		viewer: wsdomain.RoleViewer}, tdb.Pool)
	card := e.Card(member, ws, e.Project(owner, ws, "Core"), "Files")

	img, err := e.Attachments.Upload(ctx, member, card.ID, "../shot.png", bytes.NewReader(png))
	if err != nil {
		t.Fatal(err)
	}
	if img.Name != "shot.png" || img.ContentType != "image/png" || img.Size != int64(len(png)) || img.Uploader == nil {
		t.Fatalf("uploaded %+v", img)
	}
	// The client's claimed type is irrelevant: HTML is sniffed as text/html and never inlined.
	page, err := e.Attachments.Upload(ctx, member, card.ID, "x.png", strings.NewReader("<html><script>alert(1)</script>"))
	if err != nil || domain.InlineTypes[page.ContentType] {
		t.Fatalf("sniffed %q %v", page.ContentType, err)
	}
	_, err = e.Attachments.Upload(ctx, member, card.ID, "big.bin", bytes.NewReader(make([]byte, testkit.AttachmentMaxBytes+1)))
	mustCode(t, err, domain.ErrTooLarge)
	_, err = e.Attachments.Upload(ctx, viewer, card.ID, "v.txt", strings.NewReader("x"))
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	got, _ := e.Cards.Get(ctx, owner, card.ID)
	if got.AttachmentCount != 2 {
		t.Fatalf("attachment counter = %d", got.AttachmentCount)
	}
	list, err := e.Attachments.List(ctx, viewer, card.ID)
	if err != nil || len(list) != 2 {
		t.Fatalf("list %d %v", len(list), err)
	}
	meta, f, err := e.Attachments.Open(ctx, viewer, img.ID)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(f)
	_ = f.Close()
	if !bytes.Equal(b, png) || meta.Name != "shot.png" {
		t.Fatal("download returned other bytes")
	}

	mustCode(t, e.Attachments.Delete(ctx, other, img.ID), domain.ErrForbidden)
	if err := e.Attachments.Delete(ctx, owner, page.ID); err != nil { // admin
		t.Fatal(err)
	}
	if err := e.Attachments.Delete(ctx, member, img.ID); err != nil { // uploader
		t.Fatal(err)
	}
	_, _, err = e.Attachments.Open(ctx, member, img.ID)
	mustCode(t, err, domain.ErrNotFound)
	got, _ = e.Cards.Get(ctx, owner, card.ID)
	if got.AttachmentCount != 0 {
		t.Fatalf("counter after deletes = %d", got.AttachmentCount)
	}
	stranger := e.User("Stranger", "s@example.com")
	_, err = e.Attachments.List(ctx, stranger, card.ID)
	mustCode(t, err, carddomain.ErrNotFound)
}
