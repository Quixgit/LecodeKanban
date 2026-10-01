// Package httpx contains JSON request/response helpers and the error-returning handler adapter.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

// MaxBodyBytes caps JSON request bodies.
const MaxBodyBytes = 1 << 20

// HandlerFunc is an http handler that returns an error instead of writing it.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// H adapts a HandlerFunc to http.HandlerFunc, rendering returned errors.
func H(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			WriteError(w, r, err)
		}
	}
}

// ErrorBody is the wire format of every error response.
type ErrorBody struct {
	Error ErrorPayload `json:"error"`
}

type ErrorPayload struct {
	Code    apperr.Code         `json:"code"`
	Message string              `json:"message"`
	Fields  []apperr.FieldError `json:"fields,omitempty"`
	Meta    map[string]any      `json:"meta,omitempty"`
}

// WriteError renders err as JSON. 5xx causes are logged; their details never reach the client.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	ae := apperr.From(err)
	status := ae.Status()
	msg := ae.Message
	if status >= 500 {
		logger.From(r.Context()).Error("request failed", slog.String("code", string(ae.Code)), slog.Any("err", err))
		msg = "internal error"
	}
	WriteJSON(w, status, ErrorBody{Error: ErrorPayload{Code: ae.Code, Message: msg, Fields: ae.Fields, Meta: ae.Meta}})
}

// WriteJSON writes v with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// NoContent writes 204.
func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// DecodeJSON strictly decodes a JSON body into dst (unknown fields rejected, size capped).
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		return apperr.New(apperr.BadRequest, "content-type must be application/json")
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		switch {
		case errors.As(err, &mbe):
			return apperr.New(apperr.TooLarge, "request body too large")
		case errors.Is(err, io.EOF):
			return apperr.New(apperr.BadRequest, "request body is empty")
		default:
			return apperr.Wrap(apperr.BadRequest, "malformed JSON body", err)
		}
	}
	if dec.More() {
		return apperr.New(apperr.BadRequest, "request body must contain a single JSON object")
	}
	return nil
}
