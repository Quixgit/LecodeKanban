package domain_test

import (
	"strings"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func TestValidateDoc(t *testing.T) {
	wrap := func(body string) string { return `{"type":"doc","content":[` + body + `]}` }
	para := func(inner string) string { return `{"type":"paragraph","content":[` + inner + `]}` }
	text := func(s, marks string) string {
		if marks != "" {
			return `{"type":"text","text":"` + s + `","marks":[` + marks + `]}`
		}
		return `{"type":"text","text":"` + s + `"}`
	}
	link := func(href string) string { return `{"type":"link","attrs":{"href":"` + href + `","title":"docs"}}` }

	ok := map[string]string{
		"empty paragraph":  wrap(`{"type":"paragraph"}`),
		"heading":          wrap(`{"type":"heading","attrs":{"level":2},"content":[` + text("Hi", "") + `]}`),
		"bold link":        wrap(para(text("x", `{"type":"bold"},`+link("https://example.com/a?b=1")))),
		"relative link":    wrap(para(text("x", link("/docs/p/abc")))),
		"mailto":           wrap(para(text("x", link("mailto:a@b.co")))),
		"task list":        wrap(`{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[` + para(text("a", "")) + `]}]}`),
		"code block":       wrap(`{"type":"codeBlock","attrs":{"language":"c++"},"content":[` + text("int main(){}", "") + `]}`),
		"callout":          wrap(`{"type":"callout","attrs":{"type":"danger"},"content":[` + para(text("careful", "")) + `]}`),
		"table":            wrap(`{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"colspan":1,"rowspan":1,"colwidth":[120]},"content":[` + para(text("h", "")) + `]}]}]}`),
		"uploaded image":   wrap(`{"type":"image","attrs":{"src":"/api/v1/wiki/files/0b6f4f0e-1c7e-4c3e-9b52-6d2b1a9e7f10/content?inline=true","alt":"x"}}`),
		"https image":      wrap(`{"type":"image","attrs":{"src":"https://cdn.example.com/a.png"}}`),
		"mermaid":          wrap(`{"type":"mermaid","attrs":{"code":"graph TD; A-->B"}}`),
		"youtube":          wrap(`{"type":"youtube","attrs":{"src":"https://www.youtube.com/embed/abc"}}`),
		"highlight colour": wrap(para(text("x", `{"type":"highlight","attrs":{"color":"#ffcc00"}}`))),
		"cyrillic":         wrap(para(text("Привіт, світе", ""))),
	}
	for name, doc := range ok {
		if _, err := domain.ValidateDoc([]byte(doc)); err != nil {
			t.Errorf("%s: unexpected error %v", name, err)
		}
	}

	bad := map[string]string{
		"not json":                `{`,
		"wrong root":              `{"type":"paragraph"}`,
		"unknown node":            wrap(`{"type":"script"}`),
		"unknown attribute":       wrap(`{"type":"paragraph","attrs":{"onclick":"x"}}`),
		"javascript link":         wrap(para(text("x", link("javascript:alert(1)")))),
		"obfuscated javascript":   wrap(para(text("x", link("java\\tscript:alert(1)")))),
		"data link":               wrap(para(text("x", link("data:text/html,<script>")))),
		"protocol-relative link":  wrap(para(text("x", link("//evil.example/x")))),
		"http image":              wrap(`{"type":"image","attrs":{"src":"http://insecure.example/a.png"}}`),
		"javascript image":        wrap(`{"type":"image","attrs":{"src":"javascript:alert(1)"}}`),
		"other-origin file path":  wrap(`{"type":"image","attrs":{"src":"/api/v1/auth/session"}}`),
		"non-youtube video":       wrap(`{"type":"youtube","attrs":{"src":"https://evil.example/x"}}`),
		"unknown mark":            wrap(para(text("x", `{"type":"script"}`))),
		"bad colour":              wrap(para(text("x", `{"type":"highlight","attrs":{"color":"red;background:url(x)"}}`))),
		"bad callout":             wrap(`{"type":"callout","attrs":{"type":"x"},"content":[]}`),
		"heading level":           wrap(`{"type":"heading","attrs":{"level":9},"content":[]}`),
		"bad file id":             wrap(`{"type":"fileAttachment","attrs":{"fileId":"../../etc/passwd"}}`),
		"marks on block":          `{"type":"doc","content":[{"type":"paragraph","marks":[{"type":"bold"}]}]}`,
		"text with children":      wrap(`{"type":"text","text":"x","content":[{"type":"paragraph"}]}`),
		"nested object attribute": wrap(`{"type":"paragraph","attrs":{"textAlign":{"a":1}}}`),
		"bad cell alignment":      wrap(`{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableCell","attrs":{"align":"expression(alert(1))"},"content":[{"type":"paragraph"}]}]}]}`),
	}
	for name, doc := range bad {
		_, err := domain.ValidateDoc([]byte(doc))
		if !apperr.IsCode(err, domain.ErrInvalidContent) {
			t.Errorf("%s: want invalid_content, got %v", name, err)
		}
	}
}

func TestValidateDocLimits(t *testing.T) {
	deep := strings.Repeat(`{"type":"blockquote","content":[`, 60) + `{"type":"paragraph"}` + strings.Repeat(`]}`, 60)
	if _, err := domain.ValidateDoc([]byte(`{"type":"doc","content":[` + deep + `]}`)); !apperr.IsCode(err, domain.ErrInvalidContent) {
		t.Fatalf("deep nesting must be refused, got %v", err)
	}
	huge := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"` + strings.Repeat("a", domain.MaxDocBytes) + `"}]}]}`
	if _, err := domain.ValidateDoc([]byte(huge)); !apperr.IsCode(err, domain.ErrContentTooLarge) {
		t.Fatalf("oversized document must be refused, got %v", err)
	}
}

func TestValidateDocExtractsText(t *testing.T) {
	doc := `{"type":"doc","content":[
	  {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Failover"}]},
	  {"type":"paragraph","content":[{"type":"text","text":"Promote the replica "},{"type":"text","text":"now","marks":[{"type":"bold"}]}]},
	  {"type":"codeBlock","attrs":{"language":"bash"},"content":[{"type":"text","text":"pg_ctl promote"}]}]}`
	got, err := domain.ValidateDoc([]byte(doc))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Failover", "Promote the replica now", "pg_ctl promote"} {
		if !strings.Contains(got, want) {
			t.Errorf("plain text %q lacks %q", got, want)
		}
	}
}

// Every built-in template, in both languages, must pass the same validation as user content.
func TestBuiltinTemplatesAreValid(t *testing.T) {
	if len(domain.BuiltinTemplates) != 8 {
		t.Fatalf("expected 8 built-in templates, got %d", len(domain.BuiltinTemplates))
	}
	for _, tpl := range domain.BuiltinTemplates {
		for _, lang := range []string{"en", "uk"} {
			if tpl.Name[lang] == "" || tpl.Desc[lang] == "" {
				t.Errorf("%s: missing %s name or description", tpl.ID, lang)
			}
			plain, err := domain.ValidateDoc(tpl.Doc(lang))
			if err != nil {
				t.Errorf("%s/%s: %v", tpl.ID, lang, err)
			}
			if plain == "" {
				t.Errorf("%s/%s: empty text", tpl.ID, lang)
			}
		}
	}
}
