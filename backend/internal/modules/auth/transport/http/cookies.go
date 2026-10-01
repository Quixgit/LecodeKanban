package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/middleware"
)

const (
	refreshCookie = "lk_rt"
	oauthCookie   = "lk_oauth"
	refreshPath   = "/api/v1/auth"
	oauthPath     = "/api/v1/auth/oauth"
)

type cookieJar struct {
	secure bool
	key    []byte // signs the OAuth state cookie
}

func (c cookieJar) set(w http.ResponseWriter, name, value, path string, exp time.Time, httpOnly bool, same http.SameSite) {
	maxAge := int(time.Until(exp).Seconds())
	if value == "" {
		maxAge = -1
	}
	// Secure is configurable (LK_COOKIE_SECURE) because dev runs over plain HTTP on the bare IP (ADR 0004).
	http.SetCookie(w, &http.Cookie{ //nolint:gosec // G124: HttpOnly/SameSite always set; Secure from config
		Name: name, Value: value, Path: path, Expires: exp, MaxAge: maxAge,
		HttpOnly: httpOnly, Secure: c.secure, SameSite: same,
	})
}

// setSession writes access + refresh cookies. On sign-in (rotateCSRF) the CSRF token is
// rotated too; plain refreshes keep it so in-flight requests are not invalidated.
func (c cookieJar) setSession(w http.ResponseWriter, s domain.Session, rotateCSRF bool) error {
	c.set(w, middleware.AccessCookie, s.AccessToken, "/api", s.AccessExp, true, http.SameSiteLaxMode)
	if s.RefreshToken != "" {
		c.set(w, refreshCookie, s.RefreshToken, refreshPath, s.RefreshExp, true, http.SameSiteStrictMode)
	}
	if !rotateCSRF {
		return nil
	}
	_, err := c.newCSRF(w)
	return err
}

func (c cookieJar) clearSession(w http.ResponseWriter) {
	past := time.Unix(0, 0)
	c.set(w, middleware.AccessCookie, "", "/api", past, true, http.SameSiteLaxMode)
	c.set(w, refreshCookie, "", refreshPath, past, true, http.SameSiteStrictMode)
}

// newCSRF issues a double-submit token readable by the SPA (not httpOnly by design).
func (c cookieJar) newCSRF(w http.ResponseWriter) (string, error) {
	tok, err := crypto.NewToken(24)
	if err != nil {
		return "", err
	}
	c.set(w, middleware.CSRFCookie, tok, "/", time.Now().Add(30*24*time.Hour), false, http.SameSiteStrictMode)
	return tok, nil
}

// oauthState is round-tripped through a signed, short-lived cookie.
type oauthState struct {
	Provider, State, Verifier, Next, Locale string
}

func (c cookieJar) sign(payload string) string {
	m := hmac.New(sha256.New, c.key)
	m.Write([]byte("oauth-state|" + payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (c cookieJar) setOAuth(w http.ResponseWriter, s oauthState) {
	enc := base64.RawURLEncoding
	payload := strings.Join([]string{
		enc.EncodeToString([]byte(s.Provider)), enc.EncodeToString([]byte(s.State)),
		enc.EncodeToString([]byte(s.Verifier)), enc.EncodeToString([]byte(s.Next)), enc.EncodeToString([]byte(s.Locale)),
	}, ".")
	// Lax: the cookie must accompany the top-level redirect back from the provider.
	c.set(w, oauthCookie, payload+"."+c.sign(payload), oauthPath, time.Now().Add(10*time.Minute), true, http.SameSiteLaxMode)
}

var errBadState = errors.New("invalid oauth state cookie")

func (c cookieJar) readOAuth(r *http.Request) (oauthState, error) {
	ck, err := r.Cookie(oauthCookie)
	if err != nil {
		return oauthState{}, errBadState
	}
	i := strings.LastIndexByte(ck.Value, '.')
	if i < 0 || !hmac.Equal([]byte(ck.Value[i+1:]), []byte(c.sign(ck.Value[:i]))) {
		return oauthState{}, errBadState
	}
	parts := strings.Split(ck.Value[:i], ".")
	if len(parts) != 5 {
		return oauthState{}, errBadState
	}
	dec := make([]string, 5)
	for j, p := range parts {
		b, err := base64.RawURLEncoding.DecodeString(p)
		if err != nil {
			return oauthState{}, errBadState
		}
		dec[j] = string(b)
	}
	return oauthState{Provider: dec[0], State: dec[1], Verifier: dec[2], Next: dec[3], Locale: dec[4]}, nil
}

func (c cookieJar) clearOAuth(w http.ResponseWriter) {
	c.set(w, oauthCookie, "", oauthPath, time.Unix(0, 0), true, http.SameSiteLaxMode)
}

// safeNext only allows same-origin relative paths (prevents open redirects).
func safeNext(next string) string {
	if !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") || strings.HasPrefix(next, "/\\") ||
		strings.ContainsAny(next, "\r\n") {
		return "/"
	}
	return next
}
