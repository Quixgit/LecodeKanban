package domain

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// The editor document is ProseMirror JSON produced by TipTap. Everything stored is checked against
// this allow-list (node types, marks, attributes, link and image targets) so a crafted request can
// never put script-capable content in a page that other people open (no stored XSS), whatever the
// client sends. Unknown types or attributes are refused, not silently dropped.

const (
	MaxDocBytes = 2 << 20 // 2 MiB of JSON
	maxDepth    = 50
	maxNodes    = 50_000
	maxAttr     = 4_000
	maxCode     = 100_000
)

var (
	ErrInvalidContent  = apperr.Define("wiki.invalid_content", http.StatusUnprocessableEntity)
	ErrContentConflict = apperr.Define("wiki.content_conflict", http.StatusConflict)
	ErrContentTooLarge = apperr.Define("wiki.content_too_large", http.StatusRequestEntityTooLarge)
)

// nodeSpec lists the attributes a node type may carry.
var nodeSpecs = map[string][]string{
	"doc":            nil,
	"paragraph":      {"textAlign"},
	"heading":        {"level", "textAlign"},
	"text":           nil,
	"hardBreak":      nil,
	"horizontalRule": nil,
	"blockquote":     nil,
	"bulletList":     nil,
	"orderedList":    {"start", "type"},
	"listItem":       nil,
	"taskList":       nil,
	"taskItem":       {"checked"},
	"codeBlock":      {"language"},
	"callout":        {"type"},
	"details":        {"open"},
	"detailsSummary": nil,
	"detailsContent": nil,
	"table":          nil,
	"tableRow":       nil,
	"tableHeader":    {"colspan", "rowspan", "colwidth", "align"},
	"tableCell":      {"colspan", "rowspan", "colwidth", "align"},
	"image":          {"src", "alt", "title", "width", "height"},
	"youtube":        {"src", "start", "width", "height"},
	"mermaid":        {"code"},
	"inlineMath":     {"latex"},
	"blockMath":      {"latex"},
	"fileAttachment": {"fileId", "name", "size"},
	"mention":        {"id", "label"},
	"pageLink":       {"nodeId", "label"},
	"cardRef":        {"cardId", "key"},
}

var markSpecs = map[string][]string{
	"bold":        nil,
	"italic":      nil,
	"underline":   nil,
	"strike":      nil,
	"code":        nil,
	"highlight":   {"color"},
	"link":        {"href", "target", "rel", "class", "title"},
	"subscript":   nil,
	"superscript": nil,
	"textStyle":   {"color"},
}

var (
	fileURL    = regexp.MustCompile(`^/api/v1/wiki/files/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/content(\?inline=true)?$`)
	hexColor   = regexp.MustCompile(`^#[0-9a-fA-F]{3,8}$`)
	uuidRE     = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	youtubeOK  = map[string]bool{"www.youtube.com": true, "youtube.com": true, "www.youtube-nocookie.com": true, "youtu.be": true}
	languageRE = regexp.MustCompile(`^[a-zA-Z0-9+#._-]{0,30}$`)
)

type docNode struct {
	Type    string         `json:"type"`
	Attrs   map[string]any `json:"attrs"`
	Content []docNode      `json:"content"`
	Text    string         `json:"text"`
	Marks   []docMark      `json:"marks"`
}

type docMark struct {
	Type  string         `json:"type"`
	Attrs map[string]any `json:"attrs"`
}

func invalid(format string, args ...any) error {
	return apperr.New(ErrInvalidContent, "invalid page content: "+fmt.Sprintf(format, args...))
}

// ValidateDoc checks a document and returns its extracted plain text (for search and export).
func ValidateDoc(raw []byte) (string, error) {
	if len(raw) > MaxDocBytes {
		return "", apperr.New(ErrContentTooLarge, "page is too large").WithMeta("maxBytes", MaxDocBytes)
	}
	var root docNode
	if err := json.Unmarshal(raw, &root); err != nil {
		return "", invalid("not valid JSON")
	}
	if root.Type != "doc" {
		return "", invalid("root must be a doc")
	}
	count := 0
	var text strings.Builder
	if err := checkNode(root, 0, &count, &text); err != nil {
		return "", err
	}
	return strings.TrimSpace(text.String()), nil
}

func checkNode(n docNode, depth int, count *int, out *strings.Builder) error {
	if depth > maxDepth {
		return invalid("nested too deeply")
	}
	if *count++; *count > maxNodes {
		return invalid("too many nodes")
	}
	allowed, ok := nodeSpecs[n.Type]
	if !ok {
		return invalid("unknown node %q", n.Type)
	}
	if err := checkAttrs("node "+n.Type, n.Type, n.Attrs, allowed); err != nil {
		return err
	}
	if n.Type == "text" {
		if len(n.Content) > 0 {
			return invalid("text nodes have no children")
		}
		if len(n.Text) > maxCode {
			return invalid("text is too long")
		}
		for _, m := range n.Marks {
			spec, ok := markSpecs[m.Type]
			if !ok {
				return invalid("unknown mark %q", m.Type)
			}
			if err := checkAttrs("mark "+m.Type, m.Type, m.Attrs, spec); err != nil {
				return err
			}
		}
		out.WriteString(n.Text)
		return nil
	}
	if len(n.Marks) > 0 {
		return invalid("%s cannot carry marks", n.Type)
	}
	if n.Text != "" {
		return invalid("%s cannot hold text directly", n.Type)
	}
	switch n.Type {
	case "mermaid":
		if c, _ := n.Attrs["code"].(string); c != "" {
			out.WriteString(c)
		}
	case "inlineMath", "blockMath":
		if c, _ := n.Attrs["latex"].(string); c != "" {
			out.WriteString(c)
		}
	case "mention", "pageLink":
		if l, _ := n.Attrs["label"].(string); l != "" {
			out.WriteString(l)
		}
	}
	for _, c := range n.Content {
		if err := checkNode(c, depth+1, count, out); err != nil {
			return err
		}
	}
	switch n.Type {
	case "paragraph", "heading", "codeBlock", "listItem", "taskItem", "tableCell", "tableHeader", "blockMath", "mermaid", "image", "detailsSummary":
		out.WriteString("\n")
	}
	return nil
}

func checkAttrs(where, typ string, attrs map[string]any, allowed []string) error {
	for k, v := range attrs {
		if !contains(allowed, k) {
			return invalid("%s: attribute %q is not allowed", where, k)
		}
		if err := checkValue(typ, k, v); err != nil {
			return invalid("%s: %v", where, err)
		}
	}
	return nil
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func checkValue(typ, key string, v any) error {
	switch val := v.(type) {
	case nil, bool:
		return nil
	case float64:
		if key == "level" && (val < 1 || val > 4) {
			return fmt.Errorf("heading level must be 1-4")
		}
		return nil
	case string:
		if len(val) > maxAttr && key != "code" && key != "latex" {
			return fmt.Errorf("%s is too long", key)
		}
		return checkString(typ, key, val)
	case []any:
		if key != "colwidth" {
			return fmt.Errorf("%s must be a scalar", key)
		}
		for _, e := range val {
			if _, ok := e.(float64); !ok {
				return fmt.Errorf("colwidth must be numbers")
			}
		}
		return nil
	default:
		return fmt.Errorf("%s has an unsupported value", key)
	}
}

func checkString(typ, key, val string) error {
	switch {
	case typ == "link" && key == "href":
		return checkLink(val)
	case typ == "image" && key == "src":
		if fileURL.MatchString(val) || isHTTPS(val) {
			return nil
		}
		return fmt.Errorf("image source must be an uploaded file or an https URL")
	case typ == "youtube" && key == "src":
		u, err := url.Parse(val)
		if err != nil || u.Scheme != "https" || !youtubeOK[u.Host] {
			return fmt.Errorf("video must be a YouTube https URL")
		}
		return nil
	case key == "color":
		if val != "" && !hexColor.MatchString(val) {
			return fmt.Errorf("color must be a hex value")
		}
		return nil
	case typ == "callout" && key == "type":
		if !contains([]string{"info", "warning", "danger", "success"}, val) {
			return fmt.Errorf("unknown callout type")
		}
		return nil
	case typ == "codeBlock" && key == "language":
		if !languageRE.MatchString(val) {
			return fmt.Errorf("bad code language")
		}
		return nil
	case key == "fileId" || key == "nodeId" || key == "cardId" || (typ == "mention" && key == "id"):
		if !uuidRE.MatchString(val) {
			return fmt.Errorf("%s must be an id", key)
		}
		return nil
	case key == "textAlign" || key == "align":
		if !contains([]string{"left", "center", "right", "justify", ""}, val) {
			return fmt.Errorf("bad alignment")
		}
		return nil
	case key == "target":
		if !contains([]string{"_blank", "_self", ""}, val) {
			return fmt.Errorf("bad link target")
		}
		return nil
	}
	return nil
}

func isHTTPS(s string) bool {
	u, err := url.Parse(s)
	return err == nil && u.Scheme == "https" && u.Host != ""
}

// checkLink allows web, mail and phone links and in-app paths; javascript:, data: and the like are
// refused (including obfuscated forms with whitespace or control characters).
func checkLink(href string) error {
	h := strings.TrimSpace(href)
	if h == "" {
		return nil
	}
	for _, r := range h {
		if r < 0x20 || r == 0x7f {
			return fmt.Errorf("link contains control characters")
		}
	}
	if strings.HasPrefix(h, "/") && !strings.HasPrefix(h, "//") {
		return nil
	}
	if strings.HasPrefix(h, "#") {
		return nil
	}
	u, err := url.Parse(h)
	if err != nil {
		return fmt.Errorf("link is not a valid URL")
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https", "mailto", "tel":
		return nil
	}
	return fmt.Errorf("links may use http, https, mailto or tel only")
}

// EmptyDoc is what a page holds before anything is written.
var EmptyDoc = []byte(`{"type":"doc","content":[{"type":"paragraph"}]}`)
