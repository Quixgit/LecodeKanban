package domain

import (
	"strings"
	"testing"
)

const sample = `{"type":"doc","content":[
 {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Rollout *plan*"}]},
 {"type":"paragraph","content":[
   {"type":"text","text":"Use "},{"type":"text","text":"bold","marks":[{"type":"bold"}]},{"type":"text","text":", "},
   {"type":"text","text":"docs","marks":[{"type":"link","attrs":{"href":"https://example.com/docs"}}]},
   {"type":"text","text":" and "},{"type":"text","text":"x<y","marks":[{"type":"code"}]}]},
 {"type":"bulletList","content":[
   {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"alpha"}]}]},
   {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"beta"}]},
     {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"nested"}]}]}]}]}]},
 {"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"done"}]}]}]},
 {"type":"codeBlock","attrs":{"language":"bash"},"content":[{"type":"text","text":"kubectl rollout status"}]},
 {"type":"callout","attrs":{"type":"warning"},"content":[{"type":"paragraph","content":[{"type":"text","text":"careful"}]}]},
 {"type":"table","content":[
   {"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"A"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"B|C"}]}]}]},
   {"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"1"}]}]},{"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"2"}]}]}]}]},
 {"type":"image","attrs":{"src":"/api/v1/wiki/files/11111111-1111-1111-1111-111111111111/content?inline=true","alt":"diagram"}},
 {"type":"fileAttachment","attrs":{"fileId":"22222222-2222-2222-2222-222222222222","name":"plan.pdf","size":10}},
 {"type":"paragraph","content":[{"type":"text","text":"bad","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}
]}`

func ctx() ExportCtx {
	return ExportCtx{Asset: func(id string) string {
		if strings.HasPrefix(id, "1111") {
			return "../assets/1111-diagram.png"
		}
		return ""
	}, Page: func(string) string { return "" }}
}

func TestToMarkdown(t *testing.T) {
	md, err := ToMarkdown([]byte(sample), ctx())
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"## Rollout \\*plan\\*",
		"Use **bold**, [docs](https://example.com/docs) and `x<y`",
		"- alpha\n- beta\n  - nested",
		"- [x] done",
		"```bash\nkubectl rollout status\n```",
		"> [!WARNING]\n> careful",
		"| A | B\\|C |\n| --- | --- |\n| 1 | 2 |",
		"![diagram](../assets/1111-diagram.png)",
		"plan.pdf", // no asset path: just the name
	} {
		if !strings.Contains(md, want) {
			t.Errorf("markdown lacks %q\n%s", want, md)
		}
	}
}

func TestToHTMLEscapesAndRewrites(t *testing.T) {
	body, err := ToHTML([]byte(sample), ctx())
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"<h2>Rollout *plan*</h2>",
		"<strong>bold</strong>",
		`<a href="https://example.com/docs" rel="noopener noreferrer">docs</a>`,
		"<code>x&lt;y</code>",
		`<li><input type="checkbox" disabled checked> <p>done</p></li>`,
		`<pre><code class="language-bash">kubectl rollout status</code></pre>`,
		`<aside class="callout callout-warning">`,
		"<th><p>B|C</p></th>",
		`<img src="../assets/1111-diagram.png" alt="diagram">`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("html lacks %q\n%s", want, body)
		}
	}
	if strings.Contains(body, "javascript:") {
		t.Fatalf("unsafe link survived:\n%s", body)
	}
	page := HTMLPage(`A <b>title</b>`, body)
	if !strings.Contains(page, "<title>A &lt;b&gt;title&lt;/b&gt;</title>") || !strings.HasPrefix(page, "<!doctype html>") {
		t.Fatalf("page shell: %.200s", page)
	}
}

func TestFileIDs(t *testing.T) {
	ids := FileIDs([]byte(sample))
	if len(ids) != 2 || ids[0] != "11111111-1111-1111-1111-111111111111" || ids[1] != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("ids = %v", ids)
	}
}
