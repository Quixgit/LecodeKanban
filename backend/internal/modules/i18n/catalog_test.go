package i18n_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	// Blank imports register every module's error codes in the apperr catalog.
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	_ "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

var localesDir = filepath.Join("..", "..", "..", "..", "frontend", "public", "locales")

func load(t *testing.T, lang string) map[string]any {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(localesDir, lang, "errors.json"))
	if err != nil {
		t.Fatalf("read %s errors.json: %v", lang, err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func has(m map[string]any, dotted string) bool {
	var cur any = m
	for _, part := range strings.Split(dotted, ".") {
		obj, ok := cur.(map[string]any)
		if !ok {
			return false
		}
		if cur, ok = obj[part]; !ok {
			return false
		}
	}
	s, ok := cur.(string)
	return ok && s != ""
}

// Every code the API can return must be translated in every UI language.
func TestEveryErrorCodeIsTranslated(t *testing.T) {
	codes := []string{}
	for _, c := range apperr.Codes() {
		if !strings.HasPrefix(string(c), "test.") {
			codes = append(codes, string(c))
		}
	}
	for _, v := range validation.All {
		codes = append(codes, "validation."+v)
	}
	for _, lang := range []string{"en", "uk"} {
		m := load(t, lang)
		for _, c := range codes {
			if !has(m, c) {
				t.Errorf("%s/errors.json is missing %q", lang, c)
			}
		}
	}
}
