package service

import (
	"fmt"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

type inviteCopy struct{ Subject, Heading, Body, Note, Button, Fallback, Footer string }

var inviteCopies = map[string]inviteCopy{
	"en": {
		Subject: "%s invited you to %s on LecodeKanban", Heading: "Join %s",
		Body:   "%s invited you to collaborate in the “%s” workspace on LecodeKanban — boards, tasks and deadlines in one place.",
		Note:   "The invitation is valid for 7 days. Sign in or create an account with this email address to accept it.",
		Button: "Accept invitation", Fallback: "If the button doesn't work, copy this link into your browser:",
		Footer: "You received this because someone invited this address. If you weren't expecting it, ignore this email.",
	},
	"uk": {
		Subject: "%s запрошує вас до %s у LecodeKanban", Heading: "Приєднуйтеся до %s",
		Body:   "%s запрошує вас до спільної роботи в просторі «%s» у LecodeKanban — дошки, задачі та дедлайни в одному місці.",
		Note:   "Запрошення дійсне 7 днів. Щоб прийняти його, увійдіть або зареєструйтеся з цією адресою.",
		Button: "Прийняти запрошення", Fallback: "Якщо кнопка не працює, скопіюйте це посилання в браузер:",
		Footer: "Ви отримали цей лист, бо хтось запросив цю адресу. Якщо ви не чекали на нього — просто проігноруйте.",
	},
}

func inviteEmail(locale, to, inviter, workspace, link string) (mailer.Message, error) {
	c, ok := inviteCopies[locale]
	if !ok {
		c, locale = inviteCopies["en"], "en"
	}
	html, text, err := mailer.Action{
		Lang: locale, Preheader: fmt.Sprintf(c.Body, inviter, workspace), Heading: fmt.Sprintf(c.Heading, workspace),
		Paragraphs:  []string{fmt.Sprintf(c.Body, inviter, workspace), c.Note},
		ButtonLabel: c.Button, ButtonURL: link, FallbackTip: c.Fallback, Footer: c.Footer,
	}.Render()
	if err != nil {
		return mailer.Message{}, err
	}
	return mailer.Message{To: to, Subject: fmt.Sprintf(c.Subject, inviter, workspace), HTML: html, Text: text}, nil
}
