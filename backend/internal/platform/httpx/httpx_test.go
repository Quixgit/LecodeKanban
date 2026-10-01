package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func TestWriteErrorHidesInternalDetails(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	H(func(http.ResponseWriter, *http.Request) error { return errors.New("db password=secret") })(rec, req)

	if rec.Code != 500 {
		t.Fatalf("status = %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "secret") {
		t.Fatal("internal error details leaked")
	}
	var body ErrorBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Code != apperr.Internal {
		t.Fatalf("code = %s", body.Error.Code)
	}
}

func TestWriteErrorAppError(t *testing.T) {
	rec := httptest.NewRecorder()
	e := apperr.New(apperr.Validation, "bad")
	e.Fields = []apperr.FieldError{{Field: "email", Code: "required"}}
	WriteError(rec, httptest.NewRequest(http.MethodGet, "/", nil), e)
	if rec.Code != 422 || !strings.Contains(rec.Body.String(), `"field":"email"`) {
		t.Fatalf("unexpected response %d %s", rec.Code, rec.Body.String())
	}
}

func TestDecodeJSON(t *testing.T) {
	type in struct {
		Name string `json:"name"`
	}
	cases := []struct {
		name, body string
		wantCode   apperr.Code
	}{
		{"ok", `{"name":"x"}`, ""},
		{"unknown field", `{"name":"x","admin":true}`, apperr.BadRequest},
		{"empty", ``, apperr.BadRequest},
		{"two objects", `{"name":"x"}{"name":"y"}`, apperr.BadRequest},
		{"too large", `{"name":"` + strings.Repeat("a", MaxBodyBytes) + `"}`, apperr.TooLarge},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tc.body))
			var dst in
			err := DecodeJSON(httptest.NewRecorder(), r, &dst)
			if tc.wantCode == "" {
				if err != nil {
					t.Fatalf("unexpected error %v", err)
				}
				return
			}
			if err == nil || apperr.From(err).Code != tc.wantCode {
				t.Fatalf("want %s, got %v", tc.wantCode, err)
			}
		})
	}
}
