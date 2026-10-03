package github

import (
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

// Register sends card changes to GitHub. Handlers return errors only so the bus can log them: GitHub
// being down never breaks the board.
func Register(bus *eventbus.Bus, svc *service.Service) {
	eventbus.Subscribe(bus, svc.OnCardMoved)
}
