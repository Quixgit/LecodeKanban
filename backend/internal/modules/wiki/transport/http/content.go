package http

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

// contentJSON writes a content response; the document is passed through as raw JSON.
func contentJSON(w http.ResponseWriter, c domain.Content) {
	type out struct {
		Doc       json.RawMessage `json:"doc"`
		Version   int             `json:"version"`
		UpdatedBy *uuid.UUID      `json:"updatedBy"`
		UpdatedAt string          `json:"updatedAt"`
	}
	httpx.WriteJSON(w, http.StatusOK, out{Doc: c.Doc, Version: c.Version, UpdatedBy: c.UpdatedBy,
		UpdatedAt: c.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000000Z07:00")})
}

func (h *Handler) getContent(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	c, err := h.svc.Content(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	contentJSON(w, c)
	return nil
}

func (h *Handler) saveContent(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	// The document is validated as raw JSON by the service; the body is capped a little above the
	// document limit so an oversized page answers wiki.content_too_large rather than a read error.
	r.Body = http.MaxBytesReader(w, r.Body, domain.MaxDocBytes+4096)
	var in struct {
		Doc     json.RawMessage `json:"doc"`
		Version int             `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return apperr.New(domain.ErrContentTooLarge, "page is too large")
		}
		return apperr.New(apperr.BadRequest, "invalid request body")
	}
	if len(in.Doc) == 0 || in.Version < 0 {
		return apperr.New(apperr.BadRequest, "doc and version are required")
	}
	c, err := h.svc.SaveContent(r.Context(), userID(r), id, in.Doc, in.Version)
	if err != nil {
		return err
	}
	contentJSON(w, c)
	return nil
}

func toFile(f domain.File) api.WikiFile {
	return api.WikiFile{Id: f.ID, Name: f.Name, ContentType: f.ContentType, Size: f.Size,
		Url: "/api/v1/wiki/files/" + f.ID.String() + "/content"}
}

// uploadFile streams the first "file" part of a multipart body straight to storage.
func (h *Handler) uploadFile(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	max := h.svc.MaxUploadBytes()
	r.Body = http.MaxBytesReader(w, r.Body, max+1<<20) // file + multipart overhead
	mr, err := r.MultipartReader()
	if err != nil {
		return apperr.New(domain.ErrNoFile, "expected multipart/form-data with a file part")
	}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return apperr.New(domain.ErrNoFile, "no file part")
		}
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return apperr.New(apperr.TooLarge, "file is too large").WithMeta("maxBytes", max)
		}
		if err != nil {
			return apperr.New(domain.ErrNoFile, "malformed multipart body")
		}
		if part.FormName() != "file" || part.FileName() == "" {
			_ = part.Close()
			continue
		}
		f, err := h.svc.UploadFile(r.Context(), userID(r), id, part.FileName(), part)
		_ = part.Close()
		if errors.As(err, &tooBig) {
			return apperr.New(apperr.TooLarge, "file is too large").WithMeta("maxBytes", max)
		}
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusCreated, toFile(f))
		return nil
	}
}

// downloadFile serves bytes as a download by default; only known image types may be shown inline,
// and a sandbox CSP neutralises anything a browser might try to execute.
func (h *Handler) downloadFile(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "fileId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	f, rc, err := h.svc.OpenFile(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	defer func() { _ = rc.Close() }()
	disposition, ctype := "attachment", "application/octet-stream"
	if domain.InlineImageTypes[f.ContentType] {
		ctype = f.ContentType
		if r.URL.Query().Get("inline") == "true" {
			disposition = "inline"
		}
	}
	hd := w.Header()
	hd.Set("Content-Type", ctype)
	hd.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": f.Name}))
	hd.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, "", f.CreatedAt, rc)
	return nil
}

func (h *Handler) templates(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	ts, err := h.svc.Templates(r.Context(), userID(r), ws, r.URL.Query().Get("lang"))
	if err != nil {
		return err
	}
	out := make([]api.WikiTemplate, len(ts))
	for i, t := range ts {
		out[i] = api.WikiTemplate{Id: t.ID, Name: t.Name, Description: t.Description, Icon: t.Icon, Builtin: t.Builtin}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createTemplate(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	var in api.WikiTemplateInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	desc := ""
	if in.Description != nil {
		desc = *in.Description
	}
	t, err := h.svc.CreateTemplate(r.Context(), userID(r), ws, in.Name, desc, in.NodeId)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, api.WikiTemplate{Id: t.ID, Name: t.Name, Description: t.Description, Icon: t.Icon, Builtin: false})
	return nil
}

func (h *Handler) deleteTemplate(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(chi.URLParam(r, "templateId"))
	if err != nil {
		return apperr.New(domain.ErrNotFound, "template not found")
	}
	if err := h.svc.DeleteTemplate(r.Context(), userID(r), ws, id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
