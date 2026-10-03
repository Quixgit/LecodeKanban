package domain

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strconv"
	"strings"
)

// Export renders a stored ProseMirror document as Markdown or as a standalone HTML page. The
// converter works on the same allow-listed node and mark set the validator accepts, so every
// stored document can be exported without the browser.

// ExportCtx tells the renderer how to point at things that live outside the document.
type ExportCtx struct {
	// Asset maps an uploaded file's id to the relative path it was written to in the archive, or ""
	// when the file is not part of the export (the original URL is kept then).
	Asset func(fileID string) string
	// Page maps a linked page's id to a relative href, or "" when that page is not exported.
	Page func(nodeID string) string
}

type enode struct {
	Type    string         `json:"type"`
	Attrs   map[string]any `json:"attrs"`
	Content []enode        `json:"content"`
	Text    string         `json:"text"`
	Marks   []struct {
		Type  string         `json:"type"`
		Attrs map[string]any `json:"attrs"`
	} `json:"marks"`
}

var wikiFileURL = regexp.MustCompile(`/api/v1/wiki/files/([0-9a-fA-F-]{36})/content`)

func parseDoc(raw []byte) (enode, error) {
	var d enode
	if err := json.Unmarshal(raw, &d); err != nil {
		return d, err
	}
	return d, nil
}

func attrStr(n enode, k string) string {
	switch v := n.Attrs[k].(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	}
	return ""
}

func attrInt(n enode, k string, def int) int {
	if v, ok := n.Attrs[k].(float64); ok {
		return int(v)
	}
	return def
}

// FileIDs lists the uploaded files a document refers to (attachments and images), without duplicates.
func FileIDs(raw []byte) []string {
	d, err := parseDoc(raw)
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	add := func(id string) {
		id = strings.ToLower(id)
		if id != "" && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	var walk func(n enode)
	walk = func(n enode) {
		switch n.Type {
		case "fileAttachment":
			add(attrStr(n, "fileId"))
		case "image":
			if m := wikiFileURL.FindStringSubmatch(attrStr(n, "src")); m != nil {
				add(m[1])
			}
		}
		for _, c := range n.Content {
			walk(c)
		}
	}
	walk(d)
	return out
}

func (c ExportCtx) src(u string) string {
	if m := wikiFileURL.FindStringSubmatch(u); m != nil && c.Asset != nil {
		if p := c.Asset(strings.ToLower(m[1])); p != "" {
			return p
		}
	}
	return u
}

// --- Markdown

var mdEscaper = strings.NewReplacer(`\`, `\\`, "`", "\\`", "*", `\*`, "_", `\_`, "[", `\[`, "]", `\]`, "<", `\<`, ">", `\>`)

func mdText(s string) string { return mdEscaper.Replace(s) }

// ToMarkdown renders the document as GitHub-flavoured Markdown.
func ToMarkdown(raw []byte, c ExportCtx) (string, error) {
	d, err := parseDoc(raw)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	mdBlocks(&b, d.Content, "", c)
	return strings.TrimSpace(b.String()) + "\n", nil
}

func mdInline(nodes []enode, c ExportCtx) string {
	var b strings.Builder
	for _, n := range nodes {
		switch n.Type {
		case "text":
			b.WriteString(mdMarks(n, c))
		case "hardBreak":
			b.WriteString("  \n")
		case "inlineMath":
			b.WriteString("$" + attrStr(n, "latex") + "$")
		case "mention":
			b.WriteString("@" + mdText(attrStr(n, "label")))
		case "pageLink":
			label := mdText(attrStr(n, "label"))
			if href := c.Page(attrStr(n, "nodeId")); href != "" && c.Page != nil {
				b.WriteString("[" + label + "](" + mdURL(href) + ")")
			} else {
				b.WriteString(label)
			}
		case "cardRef":
			b.WriteString("`" + attrStr(n, "key") + "`")
		case "image":
			b.WriteString("![" + mdText(attrStr(n, "alt")) + "](" + mdURL(c.src(attrStr(n, "src"))) + ")")
		}
	}
	return b.String()
}

func mdURL(u string) string {
	return strings.NewReplacer(" ", "%20", "(", "%28", ")", "%29").Replace(u)
}

func mdMarks(n enode, c ExportCtx) string {
	s := n.Text
	has := map[string]map[string]any{}
	for _, m := range n.Marks {
		has[m.Type] = m.Attrs
	}
	if _, ok := has["code"]; ok {
		s = "`" + strings.ReplaceAll(s, "`", "'") + "`"
	} else {
		s = mdText(s)
	}
	lead, trail := "", ""
	if t := strings.TrimLeft(s, " "); len(t) != len(s) {
		lead, s = s[:len(s)-len(t)], t
	}
	if t := strings.TrimRight(s, " "); len(t) != len(s) {
		trail, s = s[len(t):], t
	}
	if s == "" {
		return lead + trail
	}
	if _, ok := has["bold"]; ok {
		s = "**" + s + "**"
	}
	if _, ok := has["italic"]; ok {
		s = "_" + s + "_"
	}
	if _, ok := has["strike"]; ok {
		s = "~~" + s + "~~"
	}
	if _, ok := has["highlight"]; ok {
		s = "<mark>" + s + "</mark>"
	}
	if _, ok := has["underline"]; ok {
		s = "<u>" + s + "</u>"
	}
	if _, ok := has["subscript"]; ok {
		s = "<sub>" + s + "</sub>"
	}
	if _, ok := has["superscript"]; ok {
		s = "<sup>" + s + "</sup>"
	}
	if a, ok := has["link"]; ok {
		href, _ := a["href"].(string)
		if checkLink(href) == nil {
			s = "[" + s + "](" + mdURL(href) + ")"
		}
	}
	return lead + s + trail
}

func prefixLines(s, first, rest string) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	for i, l := range lines {
		p := rest
		if i == 0 {
			p = first
		}
		if l == "" {
			lines[i] = strings.TrimRight(p, " ")
		} else {
			lines[i] = p + l
		}
	}
	return strings.Join(lines, "\n")
}

func mdBlocks(b *strings.Builder, nodes []enode, indent string, c ExportCtx) {
	mdBlocksTight(b, nodes, indent, c, false)
}

// mdBlocksTight separates blocks by a blank line, or by none inside list items so lists stay compact.
func mdBlocksTight(b *strings.Builder, nodes []enode, indent string, c ExportCtx, tight bool) {
	for i, n := range nodes {
		if i > 0 && !tight {
			b.WriteString("\n")
		}
		var sb strings.Builder
		switch n.Type {
		case "paragraph":
			sb.WriteString(mdInline(n.Content, c) + "\n")
		case "heading":
			sb.WriteString(strings.Repeat("#", min(max(attrInt(n, "level", 1), 1), 6)) + " " + mdInline(n.Content, c) + "\n")
		case "horizontalRule":
			sb.WriteString("---\n")
		case "blockquote":
			var in strings.Builder
			mdBlocks(&in, n.Content, "", c)
			sb.WriteString(prefixLines(in.String(), "> ", "> ") + "\n")
		case "callout":
			var in strings.Builder
			mdBlocks(&in, n.Content, "", c)
			kind := strings.ToUpper(attrStr(n, "type"))
			if kind == "" {
				kind = "INFO"
			}
			sb.WriteString(prefixLines("[!"+kind+"]\n"+in.String(), "> ", "> ") + "\n")
		case "bulletList", "taskList":
			for _, li := range n.Content {
				var in strings.Builder
				mdBlocksTight(&in, li.Content, "", c, true)
				marker := "- "
				if n.Type == "taskList" {
					marker = "- [ ] "
					if li.Attrs["checked"] == true {
						marker = "- [x] "
					}
				}
				sb.WriteString(prefixLines(strings.TrimRight(in.String(), "\n"), marker, strings.Repeat(" ", len(marker))) + "\n")
			}
		case "orderedList":
			start := attrInt(n, "start", 1)
			for j, li := range n.Content {
				var in strings.Builder
				mdBlocksTight(&in, li.Content, "", c, true)
				marker := strconv.Itoa(start+j) + ". "
				sb.WriteString(prefixLines(strings.TrimRight(in.String(), "\n"), marker, strings.Repeat(" ", len(marker))) + "\n")
			}
		case "codeBlock":
			code := ""
			for _, t := range n.Content {
				code += t.Text
			}
			fence := "```"
			for strings.Contains(code, fence) {
				fence += "`"
			}
			sb.WriteString(fence + attrStr(n, "language") + "\n" + code + "\n" + fence + "\n")
		case "mermaid":
			sb.WriteString("```mermaid\n" + attrStr(n, "code") + "\n```\n")
		case "blockMath":
			sb.WriteString("$$\n" + attrStr(n, "latex") + "\n$$\n")
		case "image":
			sb.WriteString(mdInline([]enode{n}, c) + "\n")
		case "youtube":
			src := attrStr(n, "src")
			sb.WriteString("[" + mdText(src) + "](" + mdURL(src) + ")\n")
		case "fileAttachment":
			name := attrStr(n, "name")
			href := ""
			if c.Asset != nil {
				href = c.Asset(strings.ToLower(attrStr(n, "fileId")))
			}
			if href == "" {
				sb.WriteString(mdText(name) + "\n")
			} else {
				sb.WriteString("[" + mdText(name) + "](" + mdURL(href) + ")\n")
			}
		case "details":
			sb.WriteString(htmlBlock(n, c) + "\n")
		case "table":
			sb.WriteString(mdTable(n, c))
		default:
			sb.WriteString(mdInline(n.Content, c) + "\n")
		}
		b.WriteString(prefixLines(sb.String(), indent, indent))
		b.WriteString("\n")
	}
}

// mdTable writes a pipe table when every cell is one simple paragraph, otherwise an HTML table.
func mdTable(n enode, c ExportCtx) string {
	simple := true
	var rows [][]string
	for _, r := range n.Content {
		var row []string
		for _, cell := range r.Content {
			if len(cell.Content) > 1 || attrInt(cell, "colspan", 1) > 1 || attrInt(cell, "rowspan", 1) > 1 {
				simple = false
			}
			text := ""
			if len(cell.Content) == 1 {
				if cell.Content[0].Type != "paragraph" {
					simple = false
				}
				text = mdInline(cell.Content[0].Content, c)
			}
			row = append(row, strings.ReplaceAll(strings.ReplaceAll(text, "|", `\|`), "\n", " "))
		}
		rows = append(rows, row)
	}
	if !simple || len(rows) == 0 {
		return htmlBlock(n, c) + "\n"
	}
	cols := 0
	for _, r := range rows {
		cols = max(cols, len(r))
	}
	var b strings.Builder
	line := func(r []string) {
		for len(r) < cols {
			r = append(r, "")
		}
		b.WriteString("| " + strings.Join(r, " | ") + " |\n")
	}
	line(rows[0])
	sep := make([]string, cols)
	for i := range sep {
		sep[i] = "---"
		if len(n.Content) > 0 && i < len(n.Content[0].Content) {
			switch attrStr(n.Content[0].Content[i], "align") {
			case "center":
				sep[i] = ":---:"
			case "right":
				sep[i] = "---:"
			case "left":
				sep[i] = ":---"
			}
		}
	}
	line(sep)
	for _, r := range rows[1:] {
		line(r)
	}
	return b.String()
}

// --- HTML

// ToHTML renders the body of the document as HTML (without the page shell).
func ToHTML(raw []byte, c ExportCtx) (string, error) {
	d, err := parseDoc(raw)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	for _, n := range d.Content {
		b.WriteString(htmlNode(n, c))
		b.WriteString("\n")
	}
	return b.String(), nil
}

func htmlBlock(n enode, c ExportCtx) string { return htmlNode(n, c) }

func esc(s string) string { return html.EscapeString(s) }

func safeHref(u string) string {
	if err := checkLink(u); err != nil {
		return "#"
	}
	return u
}

func htmlInline(nodes []enode, c ExportCtx) string {
	var b strings.Builder
	for _, n := range nodes {
		switch n.Type {
		case "text":
			s := esc(n.Text)
			for _, m := range n.Marks {
				switch m.Type {
				case "bold":
					s = "<strong>" + s + "</strong>"
				case "italic":
					s = "<em>" + s + "</em>"
				case "underline":
					s = "<u>" + s + "</u>"
				case "strike":
					s = "<s>" + s + "</s>"
				case "code":
					s = "<code>" + s + "</code>"
				case "highlight":
					s = "<mark>" + s + "</mark>"
				case "subscript":
					s = "<sub>" + s + "</sub>"
				case "superscript":
					s = "<sup>" + s + "</sup>"
				case "link":
					href, _ := m.Attrs["href"].(string)
					s = `<a href="` + esc(safeHref(href)) + `" rel="noopener noreferrer">` + s + "</a>"
				}
			}
			b.WriteString(s)
		case "hardBreak":
			b.WriteString("<br>")
		case "inlineMath":
			b.WriteString(`<span class="math">` + esc("$"+attrStr(n, "latex")+"$") + "</span>")
		case "mention":
			b.WriteString(`<span class="mention">@` + esc(attrStr(n, "label")) + "</span>")
		case "pageLink":
			label := esc(attrStr(n, "label"))
			if c.Page != nil && c.Page(attrStr(n, "nodeId")) != "" {
				b.WriteString(`<a href="` + esc(c.Page(attrStr(n, "nodeId"))) + `">` + label + "</a>")
			} else {
				b.WriteString(label)
			}
		case "cardRef":
			b.WriteString("<code>" + esc(attrStr(n, "key")) + "</code>")
		case "image":
			b.WriteString(htmlNode(n, c))
		}
	}
	return b.String()
}

func htmlNode(n enode, c ExportCtx) string {
	style := ""
	if a := attrStr(n, "textAlign"); a == "center" || a == "right" || a == "justify" {
		style = ` style="text-align:` + a + `"`
	}
	kids := func() string {
		var b strings.Builder
		for _, k := range n.Content {
			b.WriteString(htmlNode(k, c))
		}
		return b.String()
	}
	switch n.Type {
	case "paragraph":
		return "<p" + style + ">" + htmlInline(n.Content, c) + "</p>"
	case "heading":
		l := min(max(attrInt(n, "level", 1), 1), 6)
		return fmt.Sprintf("<h%d%s>%s</h%d>", l, style, htmlInline(n.Content, c), l)
	case "horizontalRule":
		return "<hr>"
	case "blockquote":
		return "<blockquote>" + kids() + "</blockquote>"
	case "callout":
		kind := strings.ToLower(attrStr(n, "type"))
		if kind == "" {
			kind = "info"
		}
		return `<aside class="callout callout-` + esc(kind) + `">` + kids() + "</aside>"
	case "bulletList":
		return "<ul>" + kids() + "</ul>"
	case "taskList":
		return `<ul class="tasks">` + kids() + "</ul>"
	case "orderedList":
		start := ""
		if s := attrInt(n, "start", 1); s != 1 {
			start = fmt.Sprintf(` start="%d"`, s)
		}
		return "<ol" + start + ">" + kids() + "</ol>"
	case "listItem":
		return "<li>" + kids() + "</li>"
	case "taskItem":
		check := ""
		if n.Attrs["checked"] == true {
			check = " checked"
		}
		return `<li><input type="checkbox" disabled` + check + "> " + kids() + "</li>"
	case "codeBlock":
		code := ""
		for _, t := range n.Content {
			code += t.Text
		}
		cls := ""
		if l := attrStr(n, "language"); l != "" {
			cls = ` class="language-` + esc(l) + `"`
		}
		return "<pre><code" + cls + ">" + esc(code) + "</code></pre>"
	case "mermaid":
		return `<pre class="mermaid"><code>` + esc(attrStr(n, "code")) + "</code></pre>"
	case "blockMath":
		return `<div class="math">` + esc("$$"+attrStr(n, "latex")+"$$") + "</div>"
	case "image":
		src := c.src(attrStr(n, "src"))
		return `<img src="` + esc(src) + `" alt="` + esc(attrStr(n, "alt")) + `">`
	case "youtube":
		src := attrStr(n, "src")
		return `<p><a href="` + esc(safeHref(src)) + `" rel="noopener noreferrer">` + esc(src) + "</a></p>"
	case "fileAttachment":
		name := esc(attrStr(n, "name"))
		if c.Asset != nil {
			if href := c.Asset(strings.ToLower(attrStr(n, "fileId"))); href != "" {
				return `<p class="file"><a href="` + esc(href) + `" download>` + name + "</a></p>"
			}
		}
		return `<p class="file">` + name + "</p>"
	case "details":
		return "<details" + map[bool]string{true: " open", false: ""}[n.Attrs["open"] == true] + ">" + kids() + "</details>"
	case "detailsSummary":
		return "<summary>" + htmlInline(n.Content, c) + "</summary>"
	case "detailsContent":
		return "<div>" + kids() + "</div>"
	case "table":
		return "<table>" + kids() + "</table>"
	case "tableRow":
		return "<tr>" + kids() + "</tr>"
	case "tableHeader", "tableCell":
		tag := "td"
		if n.Type == "tableHeader" {
			tag = "th"
		}
		attrs := ""
		if v := attrInt(n, "colspan", 1); v > 1 {
			attrs += fmt.Sprintf(` colspan="%d"`, v)
		}
		if v := attrInt(n, "rowspan", 1); v > 1 {
			attrs += fmt.Sprintf(` rowspan="%d"`, v)
		}
		if a := attrStr(n, "align"); a == "center" || a == "right" || a == "left" {
			attrs += ` style="text-align:` + a + `"`
		}
		return "<" + tag + attrs + ">" + kids() + "</" + tag + ">"
	default:
		return htmlInline(n.Content, c)
	}
}

const pageCSS = `body{font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1c1c;max-width:46rem;margin:2.5rem auto;padding:0 1.25rem}
h1,h2,h3{line-height:1.25}a{color:#327974}img{max-width:100%;border-radius:8px}
pre{background:#f3f6f6;padding:.9rem 1rem;border-radius:8px;overflow:auto}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
:not(pre)>code{background:#f3f6f6;padding:.1em .35em;border-radius:4px}blockquote{border-left:3px solid #ddd;margin-left:0;padding-left:1rem;color:#525252}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left}th{background:#f9f9f9}
.callout{border:1px solid #b2dfdf;background:#f5fbfb;border-radius:8px;padding:.6rem 1rem;margin:1rem 0}ul.tasks{list-style:none;padding-left:.25rem}
.mention{background:#e9f4f2;border-radius:4px;padding:0 .25em}.meta{color:#6b6b6b;font-size:.9rem}mark{background:#fcf7ea}`

// HTMLPage wraps a rendered body in a standalone, print-friendly page.
func HTMLPage(title, body string) string {
	return "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
		"<title>" + esc(title) + "</title><style>" + pageCSS + "</style></head><body>\n<h1>" + esc(title) + "</h1>\n" + body + "</body></html>\n"
}
