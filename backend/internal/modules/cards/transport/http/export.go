package http

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

var exportHeader = []string{"Key", "Title", "Status", "Priority", "Progress %", "Due date", "Assignees", "Labels",
	"Project", "Created", "Updated", "Completed"}

// safeCell stops a spreadsheet from running a cell as a formula (a title starting with = + - or @).
func safeCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

func day(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format("2006-01-02")
}

// exportCSV downloads the workspace's tasks (optionally one project) as a spreadsheet-friendly CSV.
func (h *Handler) exportCSV(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	f := filterFrom(r)
	f.Sort = ""
	views, truncated, err := h.svc.Export(r.Context(), userID(r), ws, f)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="tasks-`+time.Now().UTC().Format("2006-01-02")+`.csv"`)
	w.Header().Set("X-Export-Truncated", strconv.FormatBool(truncated))
	_, _ = w.Write([]byte("\xef\xbb\xbf")) // so spreadsheets read UTF-8 (Cyrillic) correctly
	cw := csv.NewWriter(w)
	_ = cw.Write(exportHeader)
	for _, v := range views {
		people := make([]string, len(v.Assignees))
		for i, a := range v.Assignees {
			people[i] = a.Name
		}
		labels := make([]string, len(v.LabelList))
		for i, l := range v.LabelList {
			labels[i] = l.Name
		}
		created, updated := v.CreatedAt, v.UpdatedAt
		_ = cw.Write([]string{
			v.Key, safeCell(v.Title), string(v.Status), string(v.Priority), strconv.Itoa(v.Progress), day(v.DueDate),
			safeCell(strings.Join(people, "; ")), safeCell(strings.Join(labels, "; ")), safeCell(v.Project.Name),
			day(&created), day(&updated), day(v.CompletedAt),
		})
	}
	cw.Flush()
	return cw.Error()
}
