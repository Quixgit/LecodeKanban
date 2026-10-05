package http

import (
	"errors"
	"io"
	"net/http"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"

	api "github.com/reliabilix/lecodekanban/backend/internal/api"
)

// importCSV reads the multipart "file" part (capped) and creates tasks from it.
func (h *Handler) importCSV(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	project, err := uuid.Parse(r.URL.Query().Get("projectId"))
	if err != nil {
		return apperr.New(wsdomain.ErrNotFound, "project not found")
	}
	r.Body = http.MaxBytesReader(w, r.Body, service.MaxImportBytes+1<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		return apperr.New(service.ErrImportEmpty, "expected multipart/form-data with a file part")
	}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return apperr.New(service.ErrImportEmpty, "no file part")
		}
		if err != nil {
			return apperr.New(service.ErrImportTooBig, "file is too large").WithMeta("maxBytes", service.MaxImportBytes)
		}
		if part.FormName() != "file" {
			_ = part.Close()
			continue
		}
		data, err := io.ReadAll(io.LimitReader(part, service.MaxImportBytes+1))
		_ = part.Close()
		if err != nil || len(data) > service.MaxImportBytes {
			return apperr.New(service.ErrImportTooBig, "file is too large").WithMeta("maxBytes", service.MaxImportBytes)
		}
		res, err := h.svc.Import(r.Context(), userID(r), ws, project, data, r.URL.Query().Get("dryRun") == "true")
		if err != nil {
			return err
		}
		out := api.ImportResult{DryRun: res.DryRun, Created: res.Created, Skipped: res.Skipped,
			Rows: make([]api.ImportRow, len(res.Rows))}
		for i, row := range res.Rows {
			o := api.ImportRow{Line: row.Line, Title: row.Title, Warnings: row.Warnings}
			if o.Warnings == nil {
				o.Warnings = []string{}
			}
			if row.Error != "" {
				e := row.Error
				o.Error = &e
			}
			out.Rows[i] = o
		}
		httpx.WriteJSON(w, http.StatusOK, out)
		return nil
	}
}
