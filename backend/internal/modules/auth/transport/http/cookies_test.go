package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSafeNext(t *testing.T) {
	cases := map[string]string{
		"/tasks":             "/tasks",
		"/projects?view=1":   "/projects?view=1",
		"":                   "/",
		"https://evil.test":  "/",
		"//evil.test":        "/",
		"/\\evil.test":       "/",
		"/ok\r\nSet-Cookie:": "/",
	}
	for in, want := range cases {
		if got := safeNext(in); got != want {
			t.Errorf("safeNext(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOAuthStateCookieRoundTripAndTamper(t *testing.T) {
	jar := cookieJar{key: []byte("k-0123456789abcdef0123456789abcdef")}
	rec := httptest.NewRecorder()
	in := oauthState{Provider: "github", State: "s1", Verifier: "v1", Next: "/tasks", Locale: "uk"}
	jar.setOAuth(rec, in)
	ck := rec.Result().Cookies()[0]
	if !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode || ck.Path != oauthPath {
		t.Fatalf("unexpected cookie attributes %+v", ck)
	}

	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(ck)
	out, err := jar.readOAuth(req)
	if err != nil || out != in {
		t.Fatalf("round trip: %+v %v", out, err)
	}

	tampered := *ck
	tampered.Value = strings.Replace(ck.Value, ck.Value[:4], "AAAA", 1)
	req = httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&tampered)
	if _, err := jar.readOAuth(req); err == nil {
		t.Fatal("tampered cookie must be rejected")
	}

	other := cookieJar{key: []byte("another-key-0123456789abcdef0123")}
	req = httptest.NewRequest("GET", "/", nil)
	req.AddCookie(ck)
	if _, err := other.readOAuth(req); err == nil {
		t.Fatal("cookie signed with another key must be rejected")
	}
}

func TestSessionCookiesAttributes(t *testing.T) {
	jar := cookieJar{secure: true}
	rec := httptest.NewRecorder()
	jar.clearSession(rec)
	for _, c := range rec.Result().Cookies() {
		if !c.HttpOnly || !c.Secure || c.MaxAge >= 0 {
			t.Errorf("cookie %s: want httpOnly+secure+expired, got %+v", c.Name, c)
		}
	}
}
