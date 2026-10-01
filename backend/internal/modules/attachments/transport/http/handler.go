// Package http exposes attachments: multipart upload, authorised download, delete.
package http

import (
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/cards/{cardId}/attachments", httpx.H(h.list))
	r.Post("/cards/{cardId}/attachments", httpx.H(h.upload))
	r.Get("/attachments/{attachmentId}/content", httpx.H(h.download))
	r.Delete("/attachments/{attachmentId}", httpx.H(h.delete))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func param(r *http.Request, name string, code apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(code, "not found")
	}
	return id, nil
}

func toAPI(v service.View) api.Attachment {
	out := api.Attachment{Id: v.ID, Name: v.Name, ContentType: v.ContentType, Size: v.Size, CreatedAt: v.CreatedAt,
		Previewable: domain.InlineTypes[v.ContentType]}
	if v.Uploader != nil {
		out.UploadedBy = &api.PersonRef{Id: v.Uploader.ID, Name: v.Uploader.Name, AvatarUrl: v.Uploader.AvatarURL}
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.List(r.Context(), userID(r), card)
	if err != nil {
		return err
	}
	out := make([]api.Attachment, len(vs))
	for i, v := range vs {
		out[i] = toAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// upload streams the first "file" part of a multipart body straight to storage.
func (h *Handler) upload(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	r.Body = http.MaxBytesReader(w, r.Body, h.svc.MaxBytes()+1<<20) // file + multipart overhead
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
			return apperr.New(domain.ErrTooLarge, "file is too large").WithMeta("maxBytes", h.svc.MaxBytes())
		}
		if err != nil {
			return apperr.New(domain.ErrNoFile, "malformed multipart body")
		}
		if part.FormName() != "file" || part.FileName() == "" {
			_ = part.Close()
			continue
		}
		v, err := h.svc.Upload(r.Context(), userID(r), card, part.FileName(), part)
		_ = part.Close()
		if errors.As(err, &tooBig) {
			return apperr.New(domain.ErrTooLarge, "file is too large").WithMeta("maxBytes", h.svc.MaxBytes())
		}
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusCreated, toAPI(v))
		return nil
	}
}

// download serves bytes with download-by-default semantics; only known image types may be
// shown inline, and a sandbox CSP neutralises anything a browser might try to execute.
func (h *Handler) download(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "attachmentId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	a, f, err := h.svc.Open(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	disposition := "attachment"
	ctype := "application/octet-stream"
	if domain.InlineTypes[a.ContentType] {
		ctype = a.ContentType
		if r.URL.Query().Get("inline") == "true" {
			disposition = "inline"
		}
	}
	hd := w.Header()
	hd.Set("Content-Type", ctype)
	hd.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": a.Name}))
	hd.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, "", a.CreatedAt, f)
	return nil
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "attachmentId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
