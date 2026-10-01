package mailer

import (
	"bytes"
	"html/template"
	"strings"
)

// Action is a single-call-to-action transactional email (verify, reset, invite).
type Action struct {
	Lang        string
	Preheader   string
	Heading     string
	Paragraphs  []string
	ButtonLabel string
	ButtonURL   string
	FallbackTip string // "If the button doesn't work, paste this link…"
	Footer      string
}

var layout = template.Must(template.New("action").Parse(`<!doctype html>
<html lang="{{.Lang}}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{{.Heading}}</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1c1c">
<span style="display:none;max-height:0;overflow:hidden">{{.Preheader}}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #f1f1f1;border-radius:16px">
<tr><td style="padding:28px 32px 8px">
<div style="font-size:18px;font-weight:600;color:#327974">Lecode<span style="color:#4cb5ae">Kanban</span></div>
</td></tr>
<tr><td style="padding:8px 32px 0">
<h1 style="font-size:20px;line-height:28px;margin:12px 0 8px;font-weight:600">{{.Heading}}</h1>
{{range .Paragraphs}}<p style="font-size:14px;line-height:22px;color:#525252;margin:0 0 12px">{{.}}</p>{{end}}
</td></tr>
<tr><td style="padding:12px 32px 8px">
<a href="{{.ButtonURL}}" style="display:inline-block;background:#36827d;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;padding:11px 20px;border-radius:10px">{{.ButtonLabel}}</a>
</td></tr>
<tr><td style="padding:12px 32px 28px">
<p style="font-size:12px;line-height:18px;color:#737373;margin:0">{{.FallbackTip}}<br><a href="{{.ButtonURL}}" style="color:#327974;word-break:break-all">{{.ButtonURL}}</a></p>
</td></tr>
</table>
<p style="font-size:12px;color:#a1a1a1;margin:16px 0 0">{{.Footer}}</p>
</td></tr></table></body></html>`))

// Render builds the HTML and plain-text bodies for an action email.
func (a Action) Render() (html, text string, err error) {
	var buf bytes.Buffer
	if err := layout.Execute(&buf, a); err != nil {
		return "", "", err
	}
	var t strings.Builder
	t.WriteString(a.Heading + "\n\n")
	for _, p := range a.Paragraphs {
		t.WriteString(p + "\n\n")
	}
	t.WriteString(a.ButtonLabel + ": " + a.ButtonURL + "\n\n" + a.Footer + "\n")
	return buf.String(), t.String(), nil
}
