package service

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"path"
	"strings"
	"unicode"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Export limits keep one request from reading the whole workspace.
const (
	maxExportPages = 2000
	maxExportBytes = 200 << 20
)

type ExportFormat string

const (
	ExportMarkdown ExportFormat = "md"
	ExportHTML     ExportFormat = "html"
)

func (f ExportFormat) Valid() bool { return f == ExportMarkdown || f == ExportHTML }
func (f ExportFormat) ext() string { return string(f) }

// ExportEntry is one file of an export: text kept in memory, or an attachment streamed from storage.
type ExportEntry struct {
	Path       string
	Data       []byte
	StorageKey string
	Size       int64
}

// Bundle is what an export produced. One text entry is served as a plain file, anything else as a zip.
type Bundle struct {
	// Name is the base file name (without extension), taken from the page or the space.
	Name    string
	Format  ExportFormat
	Entries []ExportEntry
	// Archive is set for a space or a folder: those are always a zip, even when they hold one page.
	Archive bool
}

// Single reports whether the bundle is a lone text file.
func (b Bundle) Single() bool {
	return !b.Archive && len(b.Entries) == 1 && b.Entries[0].StorageKey == ""
}

var badName = strings.NewReplacer("/", "-", `\`, "-", ":", "-", "*", "-", "?", "-", `"`, "'", "<", "(", ">", ")", "|", "-")

// SafeName turns a title into a file or folder name that is valid on every platform.
func SafeName(title string) string {
	s := badName.Replace(strings.TrimSpace(title))
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	s = strings.Trim(s, ". ")
	if r := []rune(s); len(r) > 80 {
		s = string(r[:80])
	}
	if s == "" {
		return "Untitled"
	}
	return s
}

// ExportSpace exports every page of a space the caller can read, keeping the folder structure.
func (s *Service) ExportSpace(ctx context.Context, user, space uuid.UUID, f ExportFormat) (Bundle, error) {
	tree, err := s.Tree(ctx, user, space)
	if err != nil {
		return Bundle{}, err
	}
	return s.build(ctx, tree, nil, false, f, tree.Space.Name)
}

// ExportNode exports one page, or (with subtree) a folder or page together with everything below it.
func (s *Service) ExportNode(ctx context.Context, user, node uuid.UUID, subtree bool, f ExportFormat) (Bundle, error) {
	sc, err := s.loadNode(ctx, user, node, false)
	if err != nil {
		return Bundle{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return Bundle{}, err
	}
	tree, err := s.Tree(ctx, user, sc.node.SpaceID)
	if err != nil {
		return Bundle{}, err
	}
	return s.build(ctx, tree, sc.node, subtree, f, sc.node.Title)
}

func (s *Service) build(ctx context.Context, tree Tree, root *domain.Node, subtree bool, f ExportFormat, name string) (Bundle, error) {
	if !f.Valid() {
		return Bundle{}, apperr.New(apperr.Validation, "unknown export format")
	}
	byID := map[uuid.UUID]domain.Node{}
	for _, tn := range tree.Nodes {
		byID[tn.Node.ID] = tn.Node
	}
	inScope := func(n domain.Node) bool {
		if root == nil {
			return true
		}
		return n.ID == root.ID || (subtree && strings.HasPrefix(n.Path, root.Path))
	}
	var nodes []domain.Node
	for _, tn := range tree.Nodes {
		if inScope(tn.Node) {
			nodes = append(nodes, tn.Node)
		}
	}
	pages := 0
	for _, n := range nodes {
		if n.Kind == domain.KindPage {
			pages++
		}
	}
	if pages > maxExportPages {
		return Bundle{}, apperr.New(domain.ErrContentTooLarge, "too many pages to export at once")
	}

	// Paths: ancestors' titles are directories; names are unique within a directory.
	used := map[string]bool{}
	dirOf := map[uuid.UUID]string{}
	pagePath := map[uuid.UUID]string{}
	var dirFor func(n domain.Node) string
	dirFor = func(n domain.Node) string {
		if n.ParentID == nil || (root != nil && n.ID == root.ID) {
			return ""
		}
		p, ok := byID[*n.ParentID]
		if !ok || !inScope(p) {
			return ""
		}
		if d, ok := dirOf[p.ID]; ok {
			return d
		}
		d := path.Join(dirFor(p), SafeName(p.Title))
		dirOf[p.ID] = d
		return d
	}
	unique := func(dir, base, ext string) string {
		for i := 1; ; i++ {
			name := base
			if i > 1 {
				name = fmt.Sprintf("%s (%d)", base, i)
			}
			p := path.Join(dir, name+ext)
			if !used[strings.ToLower(p)] {
				used[strings.ToLower(p)] = true
				return p
			}
		}
	}
	for _, n := range nodes {
		if n.Kind == domain.KindPage {
			pagePath[n.ID] = unique(dirFor(n), SafeName(n.Title), "."+f.ext())
		}
	}
	rel := func(from, to string) string {
		fromDir := path.Dir(from)
		parts := strings.Split(path.Clean(fromDir), "/")
		up := 0
		if fromDir != "." {
			up = len(parts)
		}
		return strings.Repeat("../", up) + to
	}

	bundle := Bundle{Name: SafeName(name), Format: f, Archive: root == nil || subtree}
	assets := map[string]string{} // file id -> archive path
	var total int64
	for _, n := range nodes {
		if n.Kind != domain.KindPage {
			continue
		}
		c, ok, err := s.repo.Content(ctx, n.ID)
		if err != nil {
			return Bundle{}, err
		}
		doc := []byte(domain.EmptyDoc)
		if ok {
			doc = c.Doc
		}
		self := pagePath[n.ID]
		for _, id := range domain.FileIDs(doc) {
			if _, done := assets[id]; done {
				continue
			}
			fid, err := uuid.Parse(id)
			if err != nil {
				continue
			}
			file, err := s.repo.File(ctx, fid)
			if err != nil || s.storage == nil {
				continue
			}
			if _, visible := byID[file.NodeID]; !visible || !inScope(byID[file.NodeID]) {
				continue // attachments of pages outside the export (or the caller's reach) stay out
			}
			total += file.Size
			if total > maxExportBytes {
				return Bundle{}, apperr.New(domain.ErrContentTooLarge, "attachments are too large to export at once")
			}
			p := unique("assets", id[:8]+"-"+SafeName(file.Name), "")
			assets[id] = p
			bundle.Entries = append(bundle.Entries, ExportEntry{Path: p, StorageKey: file.StorageKey, Size: file.Size})
		}
		ec := domain.ExportCtx{
			Asset: func(id string) string {
				if p, ok := assets[id]; ok {
					return rel(self, p)
				}
				return ""
			},
			Page: func(id string) string {
				nid, err := uuid.Parse(id)
				if err != nil {
					return ""
				}
				if p, ok := pagePath[nid]; ok {
					return relBetween(self, p)
				}
				return ""
			},
		}
		var body string
		switch f {
		case ExportMarkdown:
			md, err := domain.ToMarkdown(doc, ec)
			if err != nil {
				return Bundle{}, apperr.Wrap(domain.ErrInvalidContent, "page content cannot be exported", err)
			}
			body = "# " + n.Title + "\n\n" + md
		case ExportHTML:
			h, err := domain.ToHTML(doc, ec)
			if err != nil {
				return Bundle{}, apperr.Wrap(domain.ErrInvalidContent, "page content cannot be exported", err)
			}
			body = domain.HTMLPage(n.Title, h)
		}
		bundle.Entries = append(bundle.Entries, ExportEntry{Path: self, Data: []byte(body)})
	}
	if bundle.Archive || len(bundle.Entries) > 1 || pages != 1 {
		bundle.Entries = append(bundle.Entries, ExportEntry{Path: "index." + f.ext(), Data: []byte(indexPage(f, nodes, pagePath, tree.Space.Name))})
	}
	if pages == 0 {
		return Bundle{}, apperr.New(domain.ErrNotFound, "nothing to export")
	}
	return bundle, nil
}

// relBetween is the relative link from one exported file to another.
func relBetween(from, to string) string {
	fromParts := strings.Split(path.Dir(from), "/")
	toParts := strings.Split(to, "/")
	if path.Dir(from) == "." {
		fromParts = nil
	}
	i := 0
	for i < len(fromParts) && i < len(toParts)-1 && fromParts[i] == toParts[i] {
		i++
	}
	return strings.Repeat("../", len(fromParts)-i) + strings.Join(toParts[i:], "/")
}

func indexPage(f ExportFormat, nodes []domain.Node, pagePath map[uuid.UUID]string, title string) string {
	var b strings.Builder
	for _, n := range nodes {
		indent := strings.Repeat("  ", min(n.Depth, 8))
		switch {
		case n.Kind == domain.KindPage && f == ExportMarkdown:
			fmt.Fprintf(&b, "%s- [%s](%s)\n", indent, strings.ReplaceAll(n.Title, "]", ")"), strings.ReplaceAll(pagePath[n.ID], " ", "%20"))
		case n.Kind == domain.KindPage:
			fmt.Fprintf(&b, "<li style=\"margin-left:%dem\"><a href=\"%s\">%s</a></li>\n", min(n.Depth, 8)*1, htmlAttr(pagePath[n.ID]), htmlText(n.Title))
		case f == ExportMarkdown:
			fmt.Fprintf(&b, "%s- **%s**\n", indent, n.Title)
		default:
			fmt.Fprintf(&b, "<li style=\"margin-left:%dem\"><strong>%s</strong></li>\n", min(n.Depth, 8)*1, htmlText(n.Title))
		}
	}
	if f == ExportMarkdown {
		return "# " + title + "\n\n" + b.String()
	}
	return domain.HTMLPage(title, "<ul style=\"list-style:none;padding:0\">\n"+b.String()+"</ul>\n")
}

func htmlText(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}
func htmlAttr(s string) string {
	return strings.NewReplacer("&", "&amp;", "\"", "&quot;", "<", "&lt;", ">", "&gt;", " ", "%20").Replace(s)
}

// WriteZip streams the bundle as a zip archive, copying attachments straight from storage.
func (s *Service) WriteZip(ctx context.Context, w io.Writer, b Bundle) error {
	zw := zip.NewWriter(w)
	for _, e := range b.Entries {
		fw, err := zw.Create(e.Path)
		if err != nil {
			return err
		}
		if e.StorageKey == "" {
			if _, err := fw.Write(e.Data); err != nil {
				return err
			}
			continue
		}
		rc, err := s.storage.Open(ctx, e.StorageKey)
		if err != nil {
			continue // a missing attachment must not spoil the whole export
		}
		_, err = io.Copy(fw, rc)
		_ = rc.Close()
		if err != nil {
			return err
		}
	}
	return zw.Close()
}
