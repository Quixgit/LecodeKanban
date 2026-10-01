package service

import (
	"fmt"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

type emailCopy struct {
	Subject, Preheader, Heading, Greeting, Body, Note, Button, Fallback, Footer string
}

// Copy for transactional emails, keyed by locale then purpose. Placeholders:
// greeting gets the user's name prepended by the renderer.
var copies = map[string]map[string]emailCopy{
	"en": {
		"verify": {
			Subject: "Confirm your email for LecodeKanban", Preheader: "One click to finish setting up your account.",
			Heading: "Confirm your email", Greeting: "Hi %s,",
			Body:   "Thanks for joining LecodeKanban. Please confirm this is your email address so we can keep your account secure.",
			Note:   "The link is valid for 48 hours. If you didn't create an account, you can ignore this email.",
			Button: "Confirm email", Fallback: "If the button doesn't work, copy this link into your browser:",
			Footer: "LecodeKanban — plan, track and ship together.",
		},
		"reset": {
			Subject: "Reset your LecodeKanban password", Preheader: "Use this link to choose a new password.",
			Heading: "Reset your password", Greeting: "Hi %s,",
			Body:   "We received a request to reset the password for your account. Choose a new one using the button below.",
			Note:   "The link is valid for 1 hour and can be used once. If you didn't ask for this, no action is needed — your password stays the same.",
			Button: "Choose a new password", Fallback: "If the button doesn't work, copy this link into your browser:",
			Footer: "LecodeKanban — plan, track and ship together.",
		},
	},
	"uk": {
		"verify": {
			Subject: "Підтвердіть email для LecodeKanban", Preheader: "Один клік — і акаунт готовий.",
			Heading: "Підтвердіть електронну пошту", Greeting: "Вітаємо, %s!",
			Body:   "Дякуємо, що приєдналися до LecodeKanban. Підтвердіть, будь ласка, що це ваша адреса — так ми зможемо захистити ваш акаунт.",
			Note:   "Посилання дійсне 48 годин. Якщо ви не створювали акаунт, просто проігноруйте цей лист.",
			Button: "Підтвердити email", Fallback: "Якщо кнопка не працює, скопіюйте це посилання в браузер:",
			Footer: "LecodeKanban — плануйте, відстежуйте та релізьте разом.",
		},
		"reset": {
			Subject: "Скидання пароля LecodeKanban", Preheader: "Скористайтеся посиланням, щоб обрати новий пароль.",
			Heading: "Скидання пароля", Greeting: "Вітаємо, %s!",
			Body:   "Ми отримали запит на скидання пароля до вашого акаунта. Оберіть новий пароль за допомогою кнопки нижче.",
			Note:   "Посилання дійсне 1 годину і може бути використане лише раз. Якщо ви не надсилали запит, нічого робити не потрібно — пароль залишиться без змін.",
			Button: "Обрати новий пароль", Fallback: "Якщо кнопка не працює, скопіюйте це посилання в браузер:",
			Footer: "LecodeKanban — плануйте, відстежуйте та релізьте разом.",
		},
	},
}

func copyFor(locale, kind string) emailCopy {
	if c, ok := copies[locale][kind]; ok {
		return c
	}
	return copies["en"][kind]
}

func render(locale, kind, to, name, link string) (mailer.Message, error) {
	c := copyFor(locale, kind)
	html, text, err := mailer.Action{
		Lang: locale, Preheader: c.Preheader, Heading: c.Heading,
		Paragraphs:  []string{fmt.Sprintf(c.Greeting, name), c.Body, c.Note},
		ButtonLabel: c.Button, ButtonURL: link, FallbackTip: c.Fallback, Footer: c.Footer,
	}.Render()
	if err != nil {
		return mailer.Message{}, err
	}
	return mailer.Message{To: to, Subject: c.Subject, HTML: html, Text: text}, nil
}

func verifyEmail(locale, to, name, link string) (mailer.Message, error) {
	return render(locale, "verify", to, name, link)
}

func resetEmail(locale, to, name, link string) (mailer.Message, error) {
	return render(locale, "reset", to, name, link)
}
