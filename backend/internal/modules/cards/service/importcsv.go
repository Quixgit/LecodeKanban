package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Import limits keep one upload from flooding a workspace.
const (
	MaxImportRows  = 2000
	MaxImportBytes = 2 << 20
)

var (
	ErrImportEmpty   = apperr.Define("cards.import_empty", 422)
	ErrImportTooBig  = apperr.Define("cards.import_too_big", 422)
	ErrImportNoTitle = apperr.Define("cards.import_no_title_column", 422)
)

// Row problems are codes the interface translates, not sentences.
const (
	RowTitleRequired  = "title_required"
	RowBadDate        = "bad_date"
	RowBadStatus      = "bad_status"
	RowBadPriority    = "bad_priority"
	RowUnknownPerson  = "unknown_assignee"
	RowUnknownLabel   = "unknown_label"
	RowRejected       = "rejected"
	RowTooManyLabels  = "too_many_labels"
	rowSeparatorChars = ";,"
)

// ImportRow is one spreadsheet line after parsing; Problems are warnings (the field was left empty) or,
// when Error is set, the reason the row was skipped.
type ImportRow struct {
	Line     int
	Title    string
	Status   domain.Status
	Priority domain.Priority
	Due      *time.Time
	People   []string
	Labels   []string
	Desc     string
	Error    string
	Warnings []string
}

var headerAliases = map[string]string{
	"title": "title", "name": "title", "task": "title", "summary": "title",
	"назва": "title", "название": "title", "задача": "title", "завдання": "title",
	"description": "desc", "details": "desc", "опис": "desc", "описание": "desc",
	"status": "status", "статус": "status",
	"priority": "priority", "пріоритет": "priority", "приоритет": "priority",
	"due date": "due", "due": "due", "deadline": "due", "термін": "due", "срок": "due", "дедлайн": "due",
	"assignees": "people", "assignee": "people", "owner": "people", "виконавці": "people", "виконавець": "people",
	"исполнители": "people", "исполнитель": "people",
	"labels": "labels", "label": "labels", "tags": "labels", "мітки": "labels", "теги": "labels", "метки": "labels",
}

var statusAliases = map[string]domain.Status{
	"todo": domain.Todo, "to do": domain.Todo, "backlog": domain.Todo, "open": domain.Todo, "new": domain.Todo,
	"до виконання": domain.Todo, "к выполнению": domain.Todo, "нове": domain.Todo,
	"in_progress": domain.InProgress, "in progress": domain.InProgress, "doing": domain.InProgress,
	"в роботі": domain.InProgress, "в работе": domain.InProgress,
	"in_review": domain.InReview, "in review": domain.InReview, "review": domain.InReview,
	"на перевірці": domain.InReview, "на проверке": domain.InReview,
	"done": domain.Done, "completed": domain.Done, "closed": domain.Done,
	"готово": domain.Done, "виконано": domain.Done, "выполнено": domain.Done,
}

var priorityAliases = map[string]domain.Priority{
	"high": domain.High, "urgent": domain.High, "високий": domain.High, "высокий": domain.High,
	"medium": domain.Medium, "normal": domain.Medium, "середній": domain.Medium, "средний": domain.Medium,
	"low": domain.Low, "низький": domain.Low, "низкий": domain.Low,
}

var dateLayouts = []string{"2006-01-02", "02.01.2006", "2.1.2006", "2006/01/02", "01/02/2006", "2 Jan 2006", "Jan 2, 2006"}

func parseDate(s string) (*time.Time, bool) {
	for _, l := range dateLayouts {
		if t, err := time.Parse(l, s); err == nil {
			return &t, true
		}
	}
	// A spreadsheet's full timestamp: keep the day.
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		d := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		return &d, true
	}
	return nil, false
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return strings.ContainsRune(rowSeparatorChars, r) }) {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// ParseImport reads a CSV (UTF-8 with or without a BOM, comma or semicolon separated) into rows.
// It does not touch the database: names are resolved later.
func ParseImport(data []byte) ([]ImportRow, error) {
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, apperr.New(ErrImportEmpty, "empty file")
	}
	r := csv.NewReader(bytes.NewReader(data))
	r.Comma = sniffComma(data)
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	head, err := r.Read()
	if err != nil {
		return nil, apperr.New(ErrImportEmpty, "empty file")
	}
	cols := map[string]int{}
	for i, h := range head {
		if k, ok := headerAliases[strings.ToLower(strings.TrimSpace(h))]; ok {
			if _, dup := cols[k]; !dup {
				cols[k] = i
			}
		}
	}
	if _, ok := cols["title"]; !ok {
		return nil, apperr.New(ErrImportNoTitle, "no title column")
	}
	cell := func(rec []string, k string) string {
		if i, ok := cols[k]; ok && i < len(rec) {
			return strings.TrimSpace(strings.TrimPrefix(rec[i], "'")) // undo the export's formula guard
		}
		return ""
	}
	var rows []ImportRow
	for line := 2; ; line++ {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			rows = append(rows, ImportRow{Line: line, Error: RowRejected})
			continue
		}
		if len(rows) >= MaxImportRows {
			return nil, apperr.New(ErrImportTooBig, "too many rows").WithMeta("max", MaxImportRows)
		}
		row := ImportRow{Line: line, Title: cell(rec, "title"), Desc: cell(rec, "desc")}
		if row.Title == "" && strings.Join(rec, "") == "" {
			continue // blank line
		}
		if row.Title == "" {
			row.Error = RowTitleRequired
		}
		if s := cell(rec, "status"); s != "" {
			if st, ok := statusAliases[strings.ToLower(s)]; ok {
				row.Status = st
			} else {
				row.Warnings = append(row.Warnings, RowBadStatus)
			}
		}
		if s := cell(rec, "priority"); s != "" {
			if p, ok := priorityAliases[strings.ToLower(s)]; ok {
				row.Priority = p
			} else {
				row.Warnings = append(row.Warnings, RowBadPriority)
			}
		}
		if s := cell(rec, "due"); s != "" {
			if d, ok := parseDate(s); ok {
				row.Due = d
			} else {
				row.Warnings = append(row.Warnings, RowBadDate)
			}
		}
		row.People = splitList(cell(rec, "people"))
		row.Labels = splitList(cell(rec, "labels"))
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return nil, apperr.New(ErrImportEmpty, "no rows")
	}
	return rows, nil
}

// sniffComma picks ; when the header line has more semicolons than commas (Excel in many locales).
func sniffComma(data []byte) rune {
	line := data
	if i := bytes.IndexByte(data, '\n'); i >= 0 {
		line = data[:i]
	}
	if bytes.Count(line, []byte(";")) > bytes.Count(line, []byte(",")) {
		return ';'
	}
	return ','
}

// ImportResult says what happened to each row; with DryRun nothing was written.
type ImportResult struct {
	DryRun  bool
	Created int
	Skipped int
	Rows    []ImportRow
}

// Import creates one task per valid row in the project. Every row goes through Create, so the
// workspace rules (required due date, default priority, member checks) apply exactly as for a hand-made task.
func (s *Service) Import(ctx context.Context, user, ws, project uuid.UUID, data []byte, dryRun bool) (ImportResult, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return ImportResult{}, err
	}
	rows, err := ParseImport(data)
	if err != nil {
		return ImportResult{}, err
	}
	ref, err := s.projects.Ref(ctx, project)
	if err != nil || ref.WorkspaceID != ws {
		var v validation.V
		v.Add("projectId", validation.NotFound, nil)
		return ImportResult{}, v.Err()
	}
	people, err := s.peopleIndex(ctx, ws)
	if err != nil {
		return ImportResult{}, err
	}
	labels, err := s.repo.Labels(ctx, ws)
	if err != nil {
		return ImportResult{}, err
	}
	labelIDs := map[string]uuid.UUID{}
	for _, l := range labels {
		labelIDs[strings.ToLower(l.Name)] = l.ID
	}

	res := ImportResult{DryRun: dryRun, Rows: rows}
	for i := range rows {
		row := &res.Rows[i]
		if row.Error != "" {
			res.Skipped++
			continue
		}
		in := domain.NewCard{ProjectID: project, Title: row.Title, Description: row.Desc,
			Status: row.Status, Priority: row.Priority, DueDate: row.Due}
		for _, p := range row.People {
			if id, ok := people[strings.ToLower(p)]; ok {
				in.AssigneeIDs = append(in.AssigneeIDs, id)
			} else {
				row.Warnings = append(row.Warnings, RowUnknownPerson)
			}
		}
		for _, l := range row.Labels {
			if id, ok := labelIDs[strings.ToLower(l)]; ok {
				in.LabelIDs = append(in.LabelIDs, id)
			} else {
				row.Warnings = append(row.Warnings, RowUnknownLabel)
			}
		}
		in.LabelIDs = dedupe(in.LabelIDs)
		if len(in.LabelIDs) > maxLabelsPerCard {
			in.LabelIDs = in.LabelIDs[:maxLabelsPerCard]
			row.Warnings = append(row.Warnings, RowTooManyLabels)
		}
		if dryRun {
			if row.Title != "" && len([]rune(row.Title)) > 300 {
				row.Error = RowRejected
				res.Skipped++
				continue
			}
			res.Created++
			continue
		}
		if _, err := s.Create(ctx, user, ws, in); err != nil {
			if ae := apperr.From(err); ae != nil && ae.Status() < 500 {
				row.Error = RowRejected
				res.Skipped++
				continue
			}
			return res, err
		}
		res.Created++
	}
	return res, nil
}

// peopleIndex maps a lower-cased name or e-mail of every member to their id.
func (s *Service) peopleIndex(ctx context.Context, ws uuid.UUID) (map[string]uuid.UUID, error) {
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(roles))
	for id := range roles {
		ids = append(ids, id)
	}
	users, err := s.users.GetMany(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := map[string]uuid.UUID{}
	for _, u := range users {
		out[strings.ToLower(u.Email)] = u.ID
		if _, taken := out[strings.ToLower(u.Name)]; !taken {
			out[strings.ToLower(u.Name)] = u.ID
		}
	}
	return out, nil
}
