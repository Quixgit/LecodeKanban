package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/ratelimit"
)

var ok = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

func TestCSRF(t *testing.T) {
	h := CSRF([]string{"http://app.test"}, "/webhooks/github")(ok)
	cases := []struct {
		name, method, path, origin, cookie, header string
		want                                       int
	}{
		{"get passes", "GET", "/x", "", "", "", 200},
		{"post without token", "POST", "/x", "", "", "", 403},
		{"post mismatched", "POST", "/x", "", "a", "b", 403},
		{"post matching", "POST", "/x", "", "tok", "tok", 200},
		{"bad origin", "POST", "/x", "http://evil.test", "tok", "tok", 403},
		{"good origin", "POST", "/x", "http://app.test", "tok", "tok", 200},
		{"exempt webhook", "POST", "/webhooks/github", "", "", "", 200},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if tc.cookie != "" {
				r.AddCookie(&http.Cookie{Name: CSRFCookie, Value: tc.cookie})
			}
			if tc.header != "" {
				r.Header.Set(CSRFHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, r)
			if rec.Code != tc.want {
				t.Fatalf("got %d want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestAuthenticateAndRequire(t *testing.T) {
	tm := authtoken.NewManager([]byte("0123456789abcdef0123456789abcdef"), time.Minute)
	h := Authenticate(tm)(RequireAuth(ok))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != 401 {
		t.Fatalf("anonymous: %d", rec.Code)
	}

	tok, _, _ := tm.Issue(authtoken.Principal{UserID: uuid.New(), SessionID: uuid.New()})
	r := httptest.NewRequest("GET", "/", nil)
	r.AddCookie(&http.Cookie{Name: AccessCookie, Value: tok})
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code != 200 {
		t.Fatalf("authenticated: %d", rec.Code)
	}
}

func TestRateLimitSetsRetryAfter(t *testing.T) {
	h := ClientIP(false)(RateLimit("login", ratelimit.NewMemory(1, time.Minute))(ok))
	do := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/", nil)
		r.RemoteAddr = "1.2.3.4:5555"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec
	}
	if do().Code != 200 {
		t.Fatal("first request should pass")
	}
	rec := do()
	if rec.Code != 429 || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("expected 429 with Retry-After, got %d", rec.Code)
	}
}

func TestClientIPTrustProxy(t *testing.T) {
	var got string
	capture := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { got = IPFrom(r.Context()) })
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.1:1"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.9") // client spoofed 6.6.6.6; proxy appended .9
	ClientIP(false)(capture).ServeHTTP(httptest.NewRecorder(), r)
	if got != "10.0.0.1" {
		t.Fatalf("untrusted proxy headers must be ignored, got %s", got)
	}
	ClientIP(true)(capture).ServeHTTP(httptest.NewRecorder(), r)
	if got != "203.0.113.9" {
		t.Fatalf("rightmost (proxy-appended) XFF entry must win, got %s", got)
	}
}

func TestRequestIDRecovererHeaders(t *testing.T) {
	var buf bytes.Buffer
	log := slog.New(slog.NewTextHandler(&buf, nil))
	panicky := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	h := RequestID(log)(SecurityHeaders(true)(AccessLog(Recoverer(panicky))))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x?token=secret", nil))
	if rec.Code != 500 {
		t.Fatalf("panic should become 500, got %d", rec.Code)
	}
	if rec.Header().Get(RequestIDHeader) == "" || rec.Header().Get("X-Frame-Options") != "DENY" ||
		rec.Header().Get("Strict-Transport-Security") == "" {
		t.Fatal("missing headers")
	}
	if bytes.Contains(buf.Bytes(), []byte("secret")) {
		t.Fatal("query string must not be logged")
	}
}
