package domain

import "encoding/json"

// BuiltinTemplate is a ready-made page layout available in every workspace, in both languages.
// Custom templates made by workspace admins are stored in the database instead.
type BuiltinTemplate struct {
	ID   string
	Icon string // Lucide key, see the frontend icon registry
	Name map[string]string
	Desc map[string]string
	doc  map[string]func() []byte
}

// Doc returns the template's document in the given language (falls back to English).
func (t BuiltinTemplate) Doc(lang string) []byte {
	if f, ok := t.doc[lang]; ok {
		return f()
	}
	return t.doc["en"]()
}

const BuiltinPrefix = "builtin:"

// --- a tiny builder for ProseMirror JSON

type node = map[string]any

func text(s string) node { return node{"type": "text", "text": s} }

func bold(s string) node {
	return node{"type": "text", "text": s, "marks": []node{{"type": "bold"}}}
}

func p(parts ...any) node {
	n := node{"type": "paragraph"}
	var content []node
	for _, part := range parts {
		switch v := part.(type) {
		case string:
			content = append(content, text(v))
		case node:
			content = append(content, v)
		}
	}
	if len(content) > 0 {
		n["content"] = content
	}
	return n
}

func h(level int, s string) node {
	return node{"type": "heading", "attrs": node{"level": level}, "content": []node{text(s)}}
}

func ul(items ...string) node {
	var li []node
	for _, it := range items {
		li = append(li, node{"type": "listItem", "content": []node{p(it)}})
	}
	return node{"type": "bulletList", "content": li}
}

func ol(items ...string) node {
	var li []node
	for _, it := range items {
		li = append(li, node{"type": "listItem", "content": []node{p(it)}})
	}
	return node{"type": "orderedList", "attrs": node{"start": 1}, "content": li}
}

func tasks(items ...string) node {
	var li []node
	for _, it := range items {
		li = append(li, node{"type": "taskItem", "attrs": node{"checked": false}, "content": []node{p(it)}})
	}
	return node{"type": "taskList", "content": li}
}

func callout(kind string, s string) node {
	return node{"type": "callout", "attrs": node{"type": kind}, "content": []node{p(s)}}
}

func code(lang, s string) node {
	return node{"type": "codeBlock", "attrs": node{"language": lang}, "content": []node{text(s)}}
}

func table(header []string, rows ...[]string) node {
	cell := func(kind, s string) node {
		return node{"type": kind, "attrs": node{"colspan": 1, "rowspan": 1}, "content": []node{p(s)}}
	}
	var trs []node
	var hc []node
	for _, c := range header {
		hc = append(hc, cell("tableHeader", c))
	}
	trs = append(trs, node{"type": "tableRow", "content": hc})
	for _, r := range rows {
		var cs []node
		for _, c := range r {
			cs = append(cs, cell("tableCell", c))
		}
		trs = append(trs, node{"type": "tableRow", "content": cs})
	}
	return node{"type": "table", "content": trs}
}

func doc(blocks ...node) func() []byte {
	return func() []byte {
		b, err := json.Marshal(node{"type": "doc", "content": blocks})
		if err != nil {
			panic(err) // static data
		}
		return b
	}
}

// BuiltinTemplates is the fixed catalogue, in display order.
var BuiltinTemplates = []BuiltinTemplate{
	{
		ID: "runbook", Icon: "life-buoy",
		Name: map[string]string{"en": "Runbook", "uk": "Ранбук"},
		Desc: map[string]string{"en": "Step-by-step procedure for an operational task.", "uk": "Покрокова процедура для операційної задачі."},
		doc: map[string]func() []byte{
			"en": doc(
				callout("info", "Use this runbook when: describe the situation that triggers it."),
				h(2, "Overview"), p("What this procedure does and who owns it."),
				h(2, "Before you start"), tasks("You have access to the production dashboards", "You have announced the work in the on-call channel"),
				h(2, "Steps"), ol("First step", "Second step", "Verify the result"),
				code("bash", "# commands go here\n"),
				h(2, "Rollback"), p("How to undo the change safely."),
				h(2, "Contacts"), ul("On-call engineer", "Service owner"),
			),
			"uk": doc(
				callout("info", "Використовуйте цей ранбук, коли: опишіть ситуацію, у якій він потрібен."),
				h(2, "Огляд"), p("Що робить ця процедура і хто за неї відповідає."),
				h(2, "Перед початком"), tasks("Є доступ до продакшн-дашбордів", "Роботи анонсовано в каналі чергових"),
				h(2, "Кроки"), ol("Перший крок", "Другий крок", "Перевірте результат"),
				code("bash", "# команди тут\n"),
				h(2, "Відкат"), p("Як безпечно скасувати зміну."),
				h(2, "Контакти"), ul("Черговий інженер", "Власник сервісу"),
			),
		},
	},
	{
		ID: "postmortem", Icon: "siren",
		Name: map[string]string{"en": "Postmortem", "uk": "Постмортем"},
		Desc: map[string]string{"en": "Blameless review of an incident: what happened and what changes.", "uk": "Розбір інциденту без пошуку винних: що сталося і що змінюємо."},
		doc: map[string]func() []byte{
			"en": doc(
				callout("warning", "Blameless: focus on systems and decisions, not on people."),
				h(2, "Summary"), p("One paragraph: impact, duration and root cause."),
				h(2, "Impact"), ul("Who was affected", "For how long", "Customer-facing symptoms"),
				h(2, "Timeline"), table([]string{"Time (UTC)", "Event"}, []string{"00:00", "Detection"}, []string{"00:00", "Mitigation"}),
				h(2, "Root cause"), p("Why it happened."),
				h(2, "What went well"), ul("…"), h(2, "What went wrong"), ul("…"),
				h(2, "Action items"), tasks("Owner — action — due date"),
			),
			"uk": doc(
				callout("warning", "Без пошуку винних: говоримо про системи й рішення, а не про людей."),
				h(2, "Підсумок"), p("Один абзац: вплив, тривалість і першопричина."),
				h(2, "Вплив"), ul("Кого зачепило", "Як довго", "Що бачили клієнти"),
				h(2, "Хронологія"), table([]string{"Час (UTC)", "Подія"}, []string{"00:00", "Виявлення"}, []string{"00:00", "Пом’якшення"}),
				h(2, "Першопричина"), p("Чому це сталося."),
				h(2, "Що спрацювало"), ul("…"), h(2, "Що не спрацювало"), ul("…"),
				h(2, "Дії"), tasks("Відповідальний — дія — термін"),
			),
		},
	},
	{
		ID: "incident", Icon: "siren",
		Name: map[string]string{"en": "Incident report", "uk": "Звіт про інцидент"},
		Desc: map[string]string{"en": "Live log of an ongoing incident.", "uk": "Живий журнал поточного інциденту."},
		doc: map[string]func() []byte{
			"en": doc(
				callout("danger", "Status: investigating"),
				h(2, "Severity"), p("SEV-?"), h(2, "Commander and roles"), ul("Incident commander", "Communications", "Operations"),
				h(2, "Current understanding"), p("What we know right now."),
				h(2, "Updates"), table([]string{"Time (UTC)", "Update"}, []string{"00:00", "Incident declared"}),
				h(2, "Next steps"), tasks("First mitigation to try"),
			),
			"uk": doc(
				callout("danger", "Статус: розслідуємо"),
				h(2, "Критичність"), p("SEV-?"), h(2, "Командир і ролі"), ul("Командир інциденту", "Комунікації", "Операції"),
				h(2, "Поточне розуміння"), p("Що ми знаємо зараз."),
				h(2, "Оновлення"), table([]string{"Час (UTC)", "Оновлення"}, []string{"00:00", "Інцидент оголошено"}),
				h(2, "Наступні кроки"), tasks("Перша спроба пом’якшення"),
			),
		},
	},
	{
		ID: "adr", Icon: "compass",
		Name: map[string]string{"en": "Architecture decision (ADR)", "uk": "Архітектурне рішення (ADR)"},
		Desc: map[string]string{"en": "Context, decision and consequences of one choice.", "uk": "Контекст, рішення та наслідки одного вибору."},
		doc: map[string]func() []byte{
			"en": doc(
				p(bold("Status: "), "proposed"), p(bold("Date: "), "YYYY-MM-DD"),
				h(2, "Context"), p("The forces at play and the problem to solve."),
				h(2, "Decision"), p("What we decided, in full sentences."),
				h(2, "Alternatives considered"), ul("Option A — why not", "Option B — why not"),
				h(2, "Consequences"), ul("What gets easier", "What gets harder"),
			),
			"uk": doc(
				p(bold("Статус: "), "запропоновано"), p(bold("Дата: "), "РРРР-ММ-ДД"),
				h(2, "Контекст"), p("Обставини та проблема, яку розв’язуємо."),
				h(2, "Рішення"), p("Що вирішили, повними реченнями."),
				h(2, "Розглянуті альтернативи"), ul("Варіант A — чому ні", "Варіант B — чому ні"),
				h(2, "Наслідки"), ul("Що стає простішим", "Що стає складнішим"),
			),
		},
	},
	{
		ID: "meeting", Icon: "users",
		Name: map[string]string{"en": "Meeting notes", "uk": "Нотатки зустрічі"},
		Desc: map[string]string{"en": "Agenda, decisions and action items.", "uk": "Порядок денний, рішення та завдання."},
		doc: map[string]func() []byte{
			"en": doc(
				p(bold("Date: "), "YYYY-MM-DD"), p(bold("Attendees: "), "names"),
				h(2, "Agenda"), ol("Topic one", "Topic two"),
				h(2, "Notes"), p("Discussion."),
				h(2, "Decisions"), ul("Decision"),
				h(2, "Action items"), tasks("Owner — action — due date"),
			),
			"uk": doc(
				p(bold("Дата: "), "РРРР-ММ-ДД"), p(bold("Учасники: "), "імена"),
				h(2, "Порядок денний"), ol("Перша тема", "Друга тема"),
				h(2, "Нотатки"), p("Обговорення."),
				h(2, "Рішення"), ul("Рішення"),
				h(2, "Завдання"), tasks("Відповідальний — дія — термін"),
			),
		},
	},
	{
		ID: "client-onboarding", Icon: "handshake",
		Name: map[string]string{"en": "Client onboarding", "uk": "Онбординг клієнта"},
		Desc: map[string]string{"en": "Checklist and contacts for a new client.", "uk": "Чекліст і контакти для нового клієнта."},
		doc: map[string]func() []byte{
			"en": doc(
				h(2, "Client"), table([]string{"Field", "Value"}, []string{"Company", ""}, []string{"Main contact", ""}, []string{"Start date", ""}),
				h(2, "Kick-off checklist"), tasks("Contract signed", "Access and accounts created", "Kick-off meeting held", "Success criteria agreed"),
				h(2, "Integrations and access"), ul("Systems we connect to", "Who grants access"),
				h(2, "Communication"), p("Channels, cadence and escalation path."),
			),
			"uk": doc(
				h(2, "Клієнт"), table([]string{"Поле", "Значення"}, []string{"Компанія", ""}, []string{"Головний контакт", ""}, []string{"Дата старту", ""}),
				h(2, "Чекліст запуску"), tasks("Договір підписано", "Доступи й акаунти створено", "Стартову зустріч проведено", "Критерії успіху узгоджено"),
				h(2, "Інтеграції та доступи"), ul("До яких систем підключаємось", "Хто надає доступ"),
				h(2, "Комунікація"), p("Канали, періодичність і ескалація."),
			),
		},
	},
	{
		ID: "sop", Icon: "clipboard-list",
		Name: map[string]string{"en": "SOP", "uk": "Стандартна процедура (SOP)"},
		Desc: map[string]string{"en": "Standard operating procedure with owner and review cadence.", "uk": "Стандартна операційна процедура з власником і періодом перегляду."},
		doc: map[string]func() []byte{
			"en": doc(
				callout("info", "Owner and review cadence are set in the page properties."),
				h(2, "Purpose"), p("Why this procedure exists."),
				h(2, "Scope"), p("Where it applies and where it does not."),
				h(2, "Procedure"), ol("Step one", "Step two", "Step three"),
				h(2, "Responsibilities"), table([]string{"Role", "Responsibility"}, []string{"", ""}),
				h(2, "Records"), p("What must be recorded and where."),
			),
			"uk": doc(
				callout("info", "Власника й період перегляду задають у властивостях сторінки."),
				h(2, "Мета"), p("Навіщо потрібна ця процедура."),
				h(2, "Межі"), p("Де застосовується, а де ні."),
				h(2, "Процедура"), ol("Крок перший", "Крок другий", "Крок третій"),
				h(2, "Відповідальність"), table([]string{"Роль", "Відповідальність"}, []string{"", ""}),
				h(2, "Записи"), p("Що фіксувати й де."),
			),
		},
	},
	{
		ID: "release-notes", Icon: "rocket",
		Name: map[string]string{"en": "Release notes", "uk": "Нотатки до релізу"},
		Desc: map[string]string{"en": "What shipped, what changed and what to watch.", "uk": "Що вийшло, що змінилося і на що звернути увагу."},
		doc: map[string]func() []byte{
			"en": doc(
				p(bold("Version: "), "0.0.0"), p(bold("Date: "), "YYYY-MM-DD"),
				h(2, "Highlights"), ul("Headline feature"),
				h(2, "Improvements"), ul("…"), h(2, "Fixes"), ul("…"),
				callout("warning", "Upgrade notes and breaking changes."),
			),
			"uk": doc(
				p(bold("Версія: "), "0.0.0"), p(bold("Дата: "), "РРРР-ММ-ДД"),
				h(2, "Головне"), ul("Ключова можливість"),
				h(2, "Покращення"), ul("…"), h(2, "Виправлення"), ul("…"),
				callout("warning", "Примітки щодо оновлення та несумісні зміни."),
			),
		},
	},
}

// FindBuiltin returns a built-in template by its id (without the "builtin:" prefix).
func FindBuiltin(id string) (BuiltinTemplate, bool) {
	for _, t := range BuiltinTemplates {
		if t.ID == id {
			return t, true
		}
	}
	return BuiltinTemplate{}, false
}
