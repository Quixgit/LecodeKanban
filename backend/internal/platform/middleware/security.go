package middleware

import (
	"crypto/subtle"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/ratelimit"
)

const (
	CSRFCookie   = "lk_csrf"
	CSRFHeader   = "X-CSRF-Token"
	AccessCookie = "lk_at"
)

func safeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

// CSRF enforces the double-submit cookie pattern for state-changing requests,
// plus an Origin check against the allowed origins. Paths in exempt (e.g.
// signature-verified webhooks) skip the check.
func CSRF(allowedOrigins []string, exempt ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if safeMethod(r.Method) || slices.Contains(exempt, r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			if o := r.Header.Get("Origin"); o != "" && !originAllowed(o, allowedOrigins) {
				httpx.WriteError(w, r, apperr.New(apperr.CSRFFailed, "origin not allowed"))
				return
			}
			c, err := r.Cookie(CSRFCookie)
			h := r.Header.Get(CSRFHeader)
			if err != nil || c.Value == "" || h == "" || subtle.ConstantTimeCompare([]byte(c.Value), []byte(h)) != 1 {
				httpx.WriteError(w, r, apperr.New(apperr.CSRFFailed, "missing or invalid CSRF token"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func originAllowed(origin string, allowed []string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	norm := u.Scheme + "://" + u.Host
	return slices.Contains(allowed, norm)
}

// Authenticate reads the access-token cookie and, when valid, stores the principal.
// It never rejects: use RequireAuth on protected routes.
func Authenticate(tm *authtoken.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if c, err := r.Cookie(AccessCookie); err == nil && c.Value != "" {
				if p, err := tm.Verify(c.Value); err == nil {
					r = r.WithContext(authtoken.WithPrincipal(r.Context(), p))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth rejects requests without a valid principal with common.unauthorized.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authtoken.FromContext(r.Context()); !ok {
			httpx.WriteError(w, r, apperr.New(apperr.Unauthorized, "authentication required"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RateLimit limits by client IP (and route group name) using l.
func RateLimit(name string, l ratelimit.Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ok, wait := l.Allow(name + "|" + IPFrom(r.Context())); !ok {
				secs := int(math.Ceil(wait.Seconds()))
				w.Header().Set("Retry-After", strconv.Itoa(secs))
				httpx.WriteError(w, r, apperr.New(apperr.RateLimited, "too many requests").WithMeta("retryAfter", secs))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RetryAfterSeconds rounds a wait up to whole seconds (helper for services).
func RetryAfterSeconds(d time.Duration) int { return int(math.Ceil(d.Seconds())) }
