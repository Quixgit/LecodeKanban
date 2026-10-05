package service_test

import (
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

func TestParseImport(t *testing.T) {
	rows, err := service.ParseImport([]byte("\xef\xbb\xbfНазва;Статус;Пріоритет;Термін;Мітки\n" +
		"Перша;в роботі;високий;31.12.2030;a; b\n" +
		";done;;;\n" +
		"Bad;wat;wat;32.13.2030;\n" +
		"\n"))
	if err != nil || len(rows) != 3 {
		t.Fatalf("rows %d, %v", len(rows), err)
	}
	r := rows[0]
	if r.Title != "Перша" || r.Status != domain.InProgress || r.Priority != domain.High || r.Due == nil || r.Due.Day() != 31 {
		t.Fatalf("row 1: %+v", r)
	}
	if rows[1].Error != service.RowTitleRequired {
		t.Fatalf("row 2 needs a title: %+v", rows[1])
	}
	if len(rows[2].Warnings) != 3 {
		t.Fatalf("row 3 warnings: %+v", rows[2].Warnings)
	}
	if _, err := service.ParseImport([]byte("a,b\n1,2\n")); !apperr.IsCode(err, service.ErrImportNoTitle) {
		t.Fatalf("no title column: %v", err)
	}
	if _, err := service.ParseImport([]byte("  ")); !apperr.IsCode(err, service.ErrImportEmpty) {
		t.Fatalf("empty: %v", err)
	}
	// The export's formula guard is undone, so a round trip keeps the title.
	rows, _ = service.ParseImport([]byte("Title\n'=SUM(A1)\n"))
	if rows[0].Title != "=SUM(A1)" {
		t.Fatalf("guard: %q", rows[0].Title)
	}
}

var pageAll = pagination.Params{Page: 1, Size: 50}

func TestImport(t *testing.T) {
	f := setup(t)
	csv := []byte("Title,Status,Assignees,Labels\nOne,done,m@example.com,\nTwo,,Nobody,Ghost\n,todo,,\n")

	dry, err := f.Cards.Import(f.ctx, f.member, f.ws, f.project, csv, true)
	if err != nil || !dry.DryRun || dry.Created != 2 || dry.Skipped != 1 {
		t.Fatalf("dry run: %+v %v", dry, err)
	}
	if len(dry.Rows[1].Warnings) != 2 {
		t.Fatalf("unknown people/labels warn: %+v", dry.Rows[1])
	}
	if _, total, _ := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{}, pageAll); total != 0 {
		t.Fatalf("a dry run writes nothing, got %d", total)
	}

	res, err := f.Cards.Import(f.ctx, f.member, f.ws, f.project, csv, false)
	if err != nil || res.Created != 2 {
		t.Fatalf("import: %+v %v", res, err)
	}
	cards, total, _ := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{}, pageAll)
	if total != 2 {
		t.Fatalf("created %d", total)
	}
	var one *service.View
	for i := range cards {
		if cards[i].Title == "One" {
			one = &cards[i]
		}
	}
	if one == nil || one.Status != domain.Done || len(one.Assignees) != 1 || one.Assignees[0].Name != "Maria Member" {
		t.Fatalf("row one: %+v", one)
	}

	_, err = f.Cards.Import(f.ctx, f.viewer, f.ws, f.project, csv, false)
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = f.Cards.Import(f.ctx, f.member, f.ws, f.project, []byte("Title\n"), false)
	mustCode(t, err, service.ErrImportEmpty)
}
