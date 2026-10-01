package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	commentssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/service"
)

func seedLabels(ctx context.Context, cards *cardssvc.Service, owner, ws uuid.UUID) (map[string]uuid.UUID, error) {
	out := map[string]uuid.UUID{}
	for _, l := range labelsSeed {
		created, err := cards.CreateLabel(ctx, owner, ws, l.Name, l.Tone)
		if err != nil {
			return nil, fmt.Errorf("label %s: %w", l.Name, err)
		}
		out[l.Name] = created.ID
	}
	return out, nil
}

// labelsFor picks labels whose keywords appear in the title.
func labelsFor(title string, ids map[string]uuid.UUID) []uuid.UUID {
	t := strings.ToLower(title)
	var out []uuid.UUID
	for _, l := range labelsSeed {
		for _, k := range l.Keywords {
			if strings.Contains(t, k) {
				out = append(out, ids[l.Name])
				break
			}
		}
	}
	return out
}

// seedChecklist gives started cards the standard checklist with roughly Progress% checked.
// Card progress itself is derived by the service (ADR 0010).
func seedChecklist(ctx context.Context, cards *cardssvc.Service, actor, card uuid.UUID, cs cardSeed) error {
	if cs.Progress == 0 {
		return nil
	}
	checked := len(checklistSteps) * cs.Progress / 100
	if carddomain.Status(cs.Status) != carddomain.Done {
		checked = min(checked, len(checklistSteps)-1)
	}
	done := true
	for i, text := range checklistSteps {
		item, err := cards.AddChecklistItem(ctx, actor, card, text)
		if err != nil {
			return err
		}
		if i < checked {
			if _, err := cards.UpdateChecklistItem(ctx, actor, item.ID, cardssvc.ItemPatch{Done: &done}); err != nil {
				return err
			}
		}
	}
	return nil
}

// seedComments posts the demo conversations; {name} placeholders become @mentions.
func seedComments(ctx context.Context, comments *commentssvc.Service, ids, cards map[string]uuid.UUID, people []person) error {
	names := map[string]string{}
	for _, p := range people {
		names[p.Email] = p.Name
	}
	for _, th := range commentsSeed {
		card, ok := cards[th.Card]
		if !ok {
			return fmt.Errorf("comment thread: unknown card %q", th.Card)
		}
		for _, m := range th.Messages {
			body := m[1]
			for handle, id := range ids {
				body = strings.ReplaceAll(body, "{"+handle+"}", fmt.Sprintf("@[%s](%s)", names[handle], id))
			}
			if _, err := comments.Create(ctx, ids[m[0]], card, body); err != nil {
				return fmt.Errorf("comment on %q: %w", th.Card, err)
			}
		}
	}
	return nil
}
