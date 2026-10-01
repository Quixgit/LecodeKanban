// Package middleware contains cross-cutting HTTP middleware.
package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

const RequestIDHeader = "X-Request-ID"

type ridKey struct{}
type ipKey struct{}

// RequestID assigns/propagates a request ID and attaches a request-scoped logger.
func RequestID(base *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get(RequestIDHeader)
			if _, err := uuid.Parse(id); err != nil {
				id = uuid.NewString()
			}
			w.Header().Set(RequestIDHeader, id)
			ctx := context.WithValue(r.Context(), ridKey{}, id)
			ctx = logger.With(ctx, base.With(slog.String("request_id", id)))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequestIDFrom(ctx context.Context) string { s, _ := ctx.Value(ridKey{}).(string); return s }

// ClientIP resolves the caller IP. When trustProxy is set (the API is only reachable
// through our own reverse proxy), the rightmost X-Forwarded-For entry is used: it is the
// one appended by that proxy, whereas leftmost entries are client-controlled.
func ClientIP(trustProxy bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}
			if trustProxy {
				if xff := r.Header.Values("X-Forwarded-For"); len(xff) > 0 {
					parts := strings.Split(xff[len(xff)-1], ",")
					if last := strings.TrimSpace(parts[len(parts)-1]); net.ParseIP(last) != nil {
						ip = last
					}
				}
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ipKey{}, ip)))
		})
	}
}

func IPFrom(ctx context.Context) string { s, _ := ctx.Value(ipKey{}).(string); return s }

type recorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *recorder) WriteHeader(c int) { r.status = c; r.ResponseWriter.WriteHeader(c) }
func (r *recorder) Write(b []byte) (int, error) {
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}
func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// AccessLog logs one line per request (never query strings: they may carry tokens).
func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &recorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		lvl := slog.LevelInfo
		if rec.status >= 500 {
			lvl = slog.LevelError
		} else if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
			lvl = slog.LevelDebug
		}
		logger.From(r.Context()).Log(r.Context(), lvl, "http",
			slog.String("method", r.Method), slog.String("path", r.URL.Path),
			slog.Int("status", rec.status), slog.Int("bytes", rec.bytes),
			slog.Duration("duration", time.Since(start)), slog.String("ip", IPFrom(r.Context())))
	})
}

// Recoverer turns panics into 500s with a logged stack trace.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if p := recover(); p != nil {
				if err, ok := p.(error); ok && errors.Is(err, http.ErrAbortHandler) {
					panic(p)
				}
				logger.From(r.Context()).Error("panic", slog.Any("panic", p), slog.String("stack", string(debug.Stack())))
				httpx.WriteError(w, r, apperr.New(apperr.Internal, "panic"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// SecurityHeaders sets conservative headers for a JSON API.
func SecurityHeaders(hsts bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			if hsts {
				h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Timeout bounds request handling time via the context.
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Accept") == "text/event-stream" { // long-lived SSE streams manage their own lifetime
				next.ServeHTTP(w, r)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
