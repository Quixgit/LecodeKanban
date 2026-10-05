package service_test

import (
	"context"
	"encoding/base64"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
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

// png is the smallest valid PNG header plus filler: enough for the magic-byte check.
var png = base64.StdEncoding.EncodeToString(append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...))

func TestSupportRequests(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Olena Owner", "o@example.com")
	admin := e.User("Adam Admin", "a@example.com")
	member := e.User("Maria Member", "m@example.com")
	other := e.User("Oksana Other", "x@example.com")
	viewer := e.User("Vira Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{admin: wsdomain.RoleAdmin, member: wsdomain.RoleMember, other: wsdomain.RoleMember,
		viewer: wsdomain.RoleViewer}, tdb.Pool)

	var mails []mailer.Message
	svc := service.New(repository.New(tdb.Pool), e.Workspaces, e.Users,
		func(_ context.Context, m mailer.Message, _ string) error { mails = append(mails, m); return nil }, slog.Default())

	// A viewer may write too; the owner and the administrator are told, the author is not.
	got, err := svc.Create(ctx, viewer, ws, service.Input{Kind: domain.Problem, Subject: "  Board is slow  ", Message: "It takes 10 s", PageURL: "http://x/tasks",
		Screenshot: png, ScreenshotType: "image/png"})
	if err != nil || got.Status != domain.New || got.Subject != "Board is slow" || !got.HasScreenshot || got.Author == nil {
		t.Fatalf("create: %+v %v", got, err)
	}
	if len(mails) != 2 {
		t.Fatalf("owner and admin are told, got %d mails", len(mails))
	}
	for _, m := range mails {
		if !strings.Contains(m.Subject, "Board is slow") || !strings.Contains(m.Text, "viewer") && !strings.Contains(m.Text, "v@example.com") {
			t.Fatalf("mail: %+v", m)
		}
	}

	// Validation and image checks.
	_, err = svc.Create(ctx, member, ws, service.Input{Kind: "rant", Subject: " ", Message: ""})
	mustCode(t, err, apperr.Validation)
	_, err = svc.Create(ctx, member, ws, service.Input{Kind: domain.Idea, Subject: "x", Message: "y", Screenshot: png, ScreenshotType: "text/html"})
	mustCode(t, err, domain.ErrImage)
	notImage := base64.StdEncoding.EncodeToString([]byte("<script>alert(1)</script>"))
	_, err = svc.Create(ctx, member, ws, service.Input{Kind: domain.Idea, Subject: "x", Message: "y", Screenshot: notImage, ScreenshotType: "image/png"})
	mustCode(t, err, domain.ErrImage)
	if _, err := svc.Create(ctx, member, ws, service.Input{Kind: domain.Idea, Subject: "Dark mode for charts", Message: "please"}); err != nil {
		t.Fatal(err)
	}
	stranger := e.User("Stranger", "s@example.com")
	_, err = svc.Create(ctx, stranger, ws, service.Input{Kind: domain.Idea, Subject: "x", Message: "y"})
	mustCode(t, err, wsdomain.ErrNotFound)

	// Who sees what: managers everything, others their own only.
	all, _ := svc.List(ctx, admin, ws, nil, false)
	mine, _ := svc.List(ctx, member, ws, nil, false)
	theirs, _ := svc.List(ctx, other, ws, nil, false)
	if len(all) != 2 || len(mine) != 1 || mine[0].Subject != "Dark mode for charts" || len(theirs) != 0 {
		t.Fatalf("visibility: all %d, member %d, other %d", len(all), len(mine), len(theirs))
	}
	if only, _ := svc.List(ctx, admin, ws, nil, true); len(only) != 0 {
		t.Fatalf("an admin's own list is just theirs: %d", len(only))
	}

	// Status: managers only; resolving stamps the time and reopening clears it.
	_, err = svc.SetStatus(ctx, member, got.ID, domain.InProgress)
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	upd, err := svc.SetStatus(ctx, admin, got.ID, domain.Resolved)
	if err != nil || upd.Status != domain.Resolved || upd.ResolvedAt == nil {
		t.Fatalf("resolve: %+v %v", upd, err)
	}
	if upd, _ = svc.SetStatus(ctx, admin, got.ID, domain.InProgress); upd.ResolvedAt != nil {
		t.Fatalf("reopening clears the resolved time: %+v", upd)
	}
	_, err = svc.SetStatus(ctx, admin, got.ID, "done")
	mustCode(t, err, apperr.Validation)
	if only, _ := svc.List(ctx, admin, ws, ptr(domain.InProgress), false); len(only) != 1 {
		t.Fatalf("status filter: %d", len(only))
	}

	// The screenshot: the author and managers see it, nobody else does.
	if s, err := svc.Screenshot(ctx, viewer, got.ID); err != nil || s.ContentType != "image/png" || len(s.Data) == 0 {
		t.Fatalf("author: %+v %v", s, err)
	}
	if _, err := svc.Screenshot(ctx, admin, got.ID); err != nil {
		t.Fatalf("manager: %v", err)
	}
	_, err = svc.Screenshot(ctx, other, got.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestOpenRequestsAreCapped(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember}, tdb.Pool)
	svc := service.New(repository.New(tdb.Pool), e.Workspaces, e.Users,
		func(context.Context, mailer.Message, string) error { return nil }, slog.Default())
	for i := 0; i < domain.MaxOpenPerAuthor; i++ {
		if _, err := svc.Create(ctx, member, ws, service.Input{Kind: domain.Question, Subject: "q", Message: "m"}); err != nil {
			t.Fatal(err)
		}
	}
	_, err := svc.Create(ctx, member, ws, service.Input{Kind: domain.Question, Subject: "one more", Message: "m"})
	mustCode(t, err, domain.ErrTooMany)
}

func ptr[T any](v T) *T { return &v }
