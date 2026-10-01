// Package apperr defines application errors carrying stable, translatable codes.
//
// The API never returns human text as the contract: clients translate `code`
// (and field `code`s) via the frontend `errors` i18n namespace. Every code is
// registered with Define so the catalog can be listed and checked for translations.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
	"sync"
)

// Code is a stable dotted identifier such as "auth.invalid_credentials".
type Code string

var (
	mu       sync.RWMutex
	registry = map[Code]int{}
)

// Define registers a code with its HTTP status. Call from package-level vars.
func Define(code string, status int) Code {
	mu.Lock()
	defer mu.Unlock()
	c := Code(code)
	if prev, ok := registry[c]; ok && prev != status {
		panic(fmt.Sprintf("apperr: code %q redefined with different status", code))
	}
	registry[c] = status
	return c
}

// Codes returns every registered code, sorted.
func Codes() []Code {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]Code, 0, len(registry))
	for c := range registry {
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// Status returns the HTTP status registered for a code (500 if unknown).
func Status(c Code) int {
	mu.RLock()
	defer mu.RUnlock()
	if s, ok := registry[c]; ok {
		return s
	}
	return http.StatusInternalServerError
}

// Common codes shared by all modules.
var (
	Internal      = Define("common.internal", http.StatusInternalServerError)
	BadRequest    = Define("common.bad_request", http.StatusBadRequest)
	Validation    = Define("common.validation", http.StatusUnprocessableEntity)
	Unauthorized  = Define("common.unauthorized", http.StatusUnauthorized)
	Forbidden     = Define("common.forbidden", http.StatusForbidden)
	NotFound      = Define("common.not_found", http.StatusNotFound)
	Conflict      = Define("common.conflict", http.StatusConflict)
	RateLimited   = Define("common.rate_limited", http.StatusTooManyRequests)
	CSRFFailed    = Define("common.csrf_failed", http.StatusForbidden)
	TooLarge      = Define("common.payload_too_large", http.StatusRequestEntityTooLarge)
	Unavailable   = Define("common.unavailable", http.StatusServiceUnavailable)
	PreconditionF = Define("common.precondition_failed", http.StatusPreconditionFailed)
)

// FieldError describes one invalid input field. Code is a validation code
// (e.g. "required", "min_length"); Params feed interpolation ({"min": 8}).
type FieldError struct {
	Field  string         `json:"field"`
	Code   string         `json:"code"`
	Params map[string]any `json:"params,omitempty"`
}

// Error is the single error type crossing module boundaries towards transport.
type Error struct {
	Code    Code
	Message string // developer-facing English fallback, never shown as-is by the UI
	Fields  []FieldError
	Meta    map[string]any // safe, client-visible extras (e.g. retry_after)
	Err     error          // internal cause; logged, never serialised
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Err }

// Is makes errors.Is match on Code, so callers can compare against sentinels.
func (e *Error) Is(target error) bool {
	var t *Error
	return errors.As(target, &t) && t.Code == e.Code
}

func (e *Error) Status() int { return Status(e.Code) }

func New(code Code, msg string) *Error { return &Error{Code: code, Message: msg} }

func Wrap(code Code, msg string, cause error) *Error {
	return &Error{Code: code, Message: msg, Err: cause}
}

// WithMeta returns a copy with extra client-visible metadata.
func (e *Error) WithMeta(k string, v any) *Error {
	cp := *e
	cp.Meta = map[string]any{}
	for mk, mv := range e.Meta {
		cp.Meta[mk] = mv
	}
	cp.Meta[k] = v
	return &cp
}

// IsCode reports whether err (or anything it wraps) is an *Error with the given code.
func IsCode(err error, code Code) bool {
	var ae *Error
	return errors.As(err, &ae) && ae.Code == code
}

// From normalises any error into *Error; unknown errors become common.internal.
func From(err error) *Error {
	var ae *Error
	if errors.As(err, &ae) {
		return ae
	}
	return Wrap(Internal, "internal error", err)
}
