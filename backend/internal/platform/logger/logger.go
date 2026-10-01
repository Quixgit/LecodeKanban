// Package logger builds the process-wide slog logger and carries request-scoped loggers in context.
package logger

import (
	"context"
	"io"
	"log/slog"
	"strings"
)

type ctxKey struct{}

// sensitiveKeys are attribute names whose values are always replaced, as a last line
// of defence against secrets leaking into logs.
var sensitiveKeys = map[string]struct{}{
	"password": {}, "token": {}, "access_token": {}, "refresh_token": {}, "secret": {},
	"authorization": {}, "cookie": {}, "set-cookie": {}, "code": {}, "client_secret": {},
}

// New returns a JSON logger in production and a human-readable one otherwise.
func New(w io.Writer, level string, json bool) *slog.Logger {
	opts := &slog.HandlerOptions{Level: parseLevel(level), ReplaceAttr: redact}
	if json {
		return slog.New(slog.NewJSONHandler(w, opts))
	}
	return slog.New(slog.NewTextHandler(w, opts))
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func redact(_ []string, a slog.Attr) slog.Attr {
	if _, ok := sensitiveKeys[strings.ToLower(a.Key)]; ok {
		return slog.String(a.Key, "[REDACTED]")
	}
	return a
}

// With stores a logger in the context.
func With(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

// From returns the request-scoped logger, or the default logger.
func From(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}
