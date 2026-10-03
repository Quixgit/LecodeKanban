package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// TemplateView is a built-in or custom template as shown in the picker.
type TemplateView struct {
	// ID is "builtin:<name>" for built-ins and a UUID for custom templates.
	ID          string
	Name        string
	Description string
	Icon        string
	Builtin     bool
}

func pickLang(lang string) string {
	if lang == "uk" {
		return "uk"
	}
	return "en"
}

// Templates lists the built-in templates (in the caller's language) and the workspace's own.
func (s *Service) Templates(ctx context.Context, user, ws uuid.UUID, lang string) ([]TemplateView, error) {
	if _, err := s.subject(ctx, ws, user); err != nil {
		return nil, err
	}
	lang = pickLang(lang)
	out := make([]TemplateView, 0, len(domain.BuiltinTemplates)+4)
	for _, t := range domain.BuiltinTemplates {
		out = append(out, TemplateView{ID: domain.BuiltinPrefix + t.ID, Name: t.Name[lang], Description: t.Desc[lang], Icon: t.Icon, Builtin: true})
	}
	custom, err := s.repo.Templates(ctx, ws)
	if err != nil {
		return nil, err
	}
	for _, t := range custom {
		out = append(out, TemplateView{ID: t.ID.String(), Name: t.Name, Description: t.Description, Icon: t.Icon})
	}
	return out, nil
}

// templateDoc resolves a template id to its document.
func (s *Service) templateDoc(ctx context.Context, ws uuid.UUID, id, lang string) ([]byte, error) {
	if name, ok := strings.CutPrefix(id, domain.BuiltinPrefix); ok {
		t, found := domain.FindBuiltin(name)
		if !found {
			return nil, apperr.New(domain.ErrNotFound, "template not found")
		}
		return t.Doc(pickLang(lang)), nil
	}
	tid, err := uuid.Parse(id)
	if err != nil {
		return nil, apperr.New(domain.ErrNotFound, "template not found")
	}
	t, err := s.repo.Template(ctx, tid)
	if err != nil || t.WorkspaceID != ws {
		return nil, apperr.New(domain.ErrNotFound, "template not found")
	}
	return t.Doc, nil
}

// CreateTemplate saves a page's current content as a custom template. Workspace admins only.
func (s *Service) CreateTemplate(ctx context.Context, user, ws uuid.UUID, name, description string, fromNode uuid.UUID) (TemplateView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermUpdate); err != nil {
		return TemplateView{}, err
	}
	name = strings.TrimSpace(name)
	var v validation.V
	if v.Required("name", name) {
		v.Length("name", name, 1, 80)
	}
	v.Length("description", description, 0, 300)
	if err := v.Err(); err != nil {
		return TemplateView{}, err
	}
	// The source page must be one the admin may read: templates can't be used to copy private pages.
	sc, err := s.loadNode(ctx, user, fromNode, false)
	if err != nil {
		return TemplateView{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return TemplateView{}, err
	}
	if sc.node.WorkspaceID != ws {
		return TemplateView{}, apperr.New(domain.ErrNotFound, "wiki element not found")
	}
	c, ok, err := s.repo.Content(ctx, fromNode)
	if err != nil {
		return TemplateView{}, err
	}
	doc := domain.EmptyDoc
	if ok {
		doc = c.Doc
	}
	t, err := s.repo.CreateTemplate(ctx, domain.Template{WorkspaceID: ws, Name: name, Description: strings.TrimSpace(description),
		Icon: sc.node.Icon, Doc: doc, CreatedBy: &user})
	if err != nil {
		return TemplateView{}, err
	}
	return TemplateView{ID: t.ID.String(), Name: t.Name, Description: t.Description, Icon: t.Icon}, nil
}

// DeleteTemplate removes a custom template. Workspace admins only.
func (s *Service) DeleteTemplate(ctx context.Context, user, ws, id uuid.UUID) error {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermUpdate); err != nil {
		return err
	}
	ok, err := s.repo.DeleteTemplate(ctx, ws, id)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.New(domain.ErrNotFound, "template not found")
	}
	return nil
}
