package http

import (
	"mime"
	"net/http"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func exportFormat(r *http.Request) (service.ExportFormat, error) {
	f := service.ExportFormat(r.URL.Query().Get("format"))
	if f == "" {
		f = service.ExportMarkdown
	}
	if !f.Valid() {
		return "", apperr.New(apperr.Validation, "format must be md or html")
	}
	return f, nil
}

// writeBundle sends one text file as is and anything bigger as a zip. Everything is an attachment
// with a sandbox CSP, so an exported page never runs in the app's origin.
func (h *Handler) writeBundle(w http.ResponseWriter, r *http.Request, b service.Bundle) error {
	hd := w.Header()
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	hd.Set("Cache-Control", "private, no-store")
	if b.Single() {
		ctype := "text/markdown; charset=utf-8"
		if b.Format == service.ExportHTML {
			ctype = "text/html; charset=utf-8"
		}
		hd.Set("Content-Type", ctype)
		hd.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": b.Name + "." + string(b.Format)}))
		_, err := w.Write(b.Entries[0].Data)
		return err
	}
	hd.Set("Content-Type", "application/zip")
	hd.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": b.Name + ".zip"}))
	return h.svc.WriteZip(r.Context(), w, b)
}

// exportSpace downloads every page of a space the caller can read.
func (h *Handler) exportSpace(w http.ResponseWriter, r *http.Request) error {
	id, err := spaceParam(r)
	if err != nil {
		return err
	}
	f, err := exportFormat(r)
	if err != nil {
		return err
	}
	b, err := h.svc.ExportSpace(r.Context(), userID(r), id, f)
	if err != nil {
		return err
	}
	return h.writeBundle(w, r, b)
}

// exportNode downloads one page, or with ?subtree=true a folder or page and everything below it.
func (h *Handler) exportNode(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "nodeId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	f, err := exportFormat(r)
	if err != nil {
		return err
	}
	b, err := h.svc.ExportNode(r.Context(), userID(r), id, r.URL.Query().Get("subtree") == "true", f)
	if err != nil {
		return err
	}
	return h.writeBundle(w, r, b)
}
