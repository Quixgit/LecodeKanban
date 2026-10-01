package main

// Demo content in the spirit of the reference screenshots, adapted to software teams.

type person struct {
	Name, Email, Role, Locale string
}

var people = []person{
	{"Peter Gabrielle", "peter", "owner", "en"},
	{"Lisa Kim", "lisa", "admin", "en"},
	{"Michael Ardi", "michael", "member", "en"},
	{"Nina Ross", "nina", "member", "en"},
	{"Leo Gracia", "leo", "member", "en"},
	{"Amira William", "amira", "member", "en"},
	{"Timmy Tom", "timmy", "member", "en"},
	{"Jesslyn Tan", "jesslyn", "member", "en"},
	{"Daniel Chong", "daniel", "admin", "en"},
	{"Олена Коваль", "olena", "viewer", "uk"},
}

type projectSeed struct {
	Name, Key, Team, Status, Icon, Tone, PIC string
	DeadlineDays                             int // relative to today; 0 = none
	Description                              string
}

var projectsSeed = []projectSeed{
	{"Onboarding Process", "ONB", "Product", "in_progress", "rocket", "amber", "jesslyn", 24, "Smooth first-week experience for new customers and teammates."},
	{"Cybersecurity Policy Update", "SEC", "Security", "completed", "shield", "teal", "michael", -20, "Refresh access policies, MFA rollout and incident runbooks."},
	{"Developer Portal", "DEV", "Platform", "pending", "code", "purple", "lisa", 55, "Self-service docs, API keys and sandbox for partners."},
	{"Mobile App v2", "MOB", "Engineering", "in_progress", "layers", "teal", "daniel", 40, "Offline mode, push notifications and a new navigation model."},
	{"Network Infrastructure Upgrade", "NET", "Infrastructure", "in_progress", "globe", "amber", "daniel", -4, "Move edge services to the new region with zero downtime."},
	{"Website SEO Optimization", "SEO", "Marketing", "completed", "target", "teal", "leo", -30, "Core Web Vitals, structured data and content refresh."},
	{"Email Marketing Launch", "EML", "Marketing", "in_progress", "megaphone", "red", "amira", 9, "Lifecycle campaigns for trial and activation."},
	{"Platform Upgrade", "PLT", "Engineering", "pending", "sparkles", "purple", "michael", 70, "Upgrade runtime, database and observability stack."},
	{"IT Compliance Review", "ITC", "Security", "in_progress", "flask", "neutral", "nina", 14, "SOC 2 evidence collection and vendor reviews."},
	{"Observability", "OBS", "Platform", "pending", "folder", "teal", "timmy", 0, "Tracing, dashboards and on-call alert tuning."},
}

type cardSeed struct {
	Project, Title, Status, Priority string
	Assignees                        []string
	DueDays                          int // relative to today; 0 = none
	Progress                         int // approximate: becomes the share of checked checklist items
}

var cardsSeed = []cardSeed{
	{"PLT", "Migrate server to new infrastructure", "todo", "medium", []string{"michael"}, 10, 0},
	{"ITC", "Set up new authentication system", "todo", "high", []string{"lisa"}, 2, 0},
	{"EML", "Test API integration with updated modules", "todo", "low", []string{"lisa"}, -1, 0},
	{"ONB", "Distribute participation surveys", "in_progress", "medium", []string{"timmy"}, -6, 80},
	{"ONB", "Schedule onboarding calls with first 20 customers", "in_progress", "high", []string{"nina"}, -7, 55},
	{"NET", "Coordinate maintenance window with vendors", "in_progress", "low", []string{"leo"}, -1, 76},
	{"ONB", "Draft onboarding checklist for new hires", "in_review", "medium", []string{"amira"}, -5, 90},
	{"DEV", "Gather system requirements from Marketing", "in_review", "high", []string{"jesslyn"}, -3, 86},
	{"MOB", "Design wellness week poster for app store", "in_review", "medium", []string{"jesslyn"}, -9, 89},
	{"SEC", "Roll out hardware keys for admins", "done", "high", []string{"michael"}, -25, 100},
	{"SEC", "Rewrite incident response runbook", "done", "medium", []string{"nina", "michael"}, -22, 100},
	{"SEO", "Fix Core Web Vitals on pricing page", "done", "high", []string{"leo"}, -35, 100},
	{"SEO", "Add structured data to blog posts", "done", "low", []string{"amira"}, -33, 100},
	{"MOB", "Offline sync for task lists", "in_progress", "high", []string{"daniel", "timmy"}, 12, 45},
	{"MOB", "Push notification preferences screen", "todo", "medium", []string{"jesslyn"}, 18, 0},
	{"MOB", "Crash reporting for Android", "done", "medium", []string{"timmy"}, -2, 100},
	{"MOB", "Redesign bottom navigation", "in_review", "medium", []string{"jesslyn", "daniel"}, 4, 95},
	{"NET", "Provision new load balancers", "done", "high", []string{"daniel"}, -12, 100},
	{"NET", "Migrate DNS to new provider", "in_progress", "high", []string{"leo", "daniel"}, -2, 60},
	{"NET", "Decommission legacy VPN", "todo", "low", []string{"leo"}, 20, 0},
	{"EML", "Write trial day-3 activation email", "in_review", "medium", []string{"amira"}, 3, 90},
	{"EML", "Set up suppression lists and unsubscribe flow", "in_progress", "high", []string{"lisa", "amira"}, 5, 40},
	{"EML", "A/B test subject lines", "todo", "low", []string{"amira"}, 15, 0},
	{"DEV", "API key management UI", "todo", "high", []string{"lisa"}, 30, 0},
	{"DEV", "Sandbox environment provisioning", "todo", "medium", []string{"michael"}, 40, 0},
	{"DEV", "Interactive API reference", "in_progress", "medium", []string{"nina"}, 25, 30},
	{"PLT", "Upgrade PostgreSQL to 16", "in_progress", "high", []string{"michael", "timmy"}, 21, 35},
	{"PLT", "Replace cron jobs with job queue", "todo", "medium", []string{"timmy"}, 35, 0},
	{"PLT", "Go 1.27 toolchain migration", "done", "low", []string{"michael"}, -3, 100},
	{"ITC", "Collect access review evidence", "in_progress", "medium", []string{"nina"}, 6, 50},
	{"ITC", "Vendor security questionnaires", "in_review", "medium", []string{"lisa"}, 1, 85},
	{"ITC", "Update data retention policy", "done", "medium", []string{"nina"}, -8, 100},
	{"OBS", "Trace sampling strategy", "todo", "medium", []string{"timmy"}, 0, 0},
	{"OBS", "On-call alert tuning", "todo", "high", []string{"timmy", "daniel"}, 9, 0},
	{"ONB", "In-app product tour", "todo", "medium", []string{"jesslyn"}, 16, 0},
	{"ONB", "Welcome email series", "done", "low", []string{"amira"}, -10, 100},
	{"ONB", "Customer success handbook", "done", "medium", []string{"nina"}, -13, 100},
	{"SEC", "Quarterly phishing simulation", "done", "low", []string{"lisa"}, -18, 100},
	{"SEO", "Content refresh for top 20 pages", "done", "medium", []string{"leo", "amira"}, -28, 100},
	{"MOB", "Biometric sign-in", "todo", "medium", []string{"daniel"}, 28, 0},
	{"MOB", "Accessibility audit fixes", "in_progress", "high", []string{"jesslyn"}, 8, 65},
	{"NET", "Edge cache warmup scripts", "done", "medium", []string{"leo"}, -6, 100},
	{"EML", "Template design system", "done", "medium", []string{"jesslyn"}, -4, 100},
	{"DEV", "Partner OAuth app registration", "in_review", "high", []string{"michael"}, 7, 92},
	{"PLT", "Feature flag service evaluation", "in_review", "low", []string{"timmy"}, 11, 88},
	{"OBS", "Service level objectives draft", "in_progress", "medium", []string{"nina"}, 13, 20},
}

// checklistSteps is the checklist given to started cards; Progress decides how many are checked.
var checklistSteps = []string{"Clarify scope and acceptance criteria", "Implement", "Write tests", "Update documentation", "Get sign-off"}

type labelSeed struct {
	Name, Tone string
	Keywords   []string // case-insensitive title matches
}

var labelsSeed = []labelSeed{
	{"Frontend", "teal", []string{"ui", "screen", "navigation", "tour", "page", "poster", "accessibility"}},
	{"Backend", "purple", []string{"api", "server", "postgresql", "job queue", "authentication", "sync", "oauth", "sandbox"}},
	{"Bug", "red", []string{"fix", "crash"}},
	{"Design", "amber", []string{"design", "redesign", "template"}},
	{"Docs", "neutral", []string{"runbook", "policy", "handbook", "reference", "checklist", "draft"}},
}

// commentThread is a short conversation on a card: {author, text}; {name} placeholders become
// mentions of that person.
type commentThread struct {
	Card     string
	Messages [][2]string
}

var commentsSeed = []commentThread{
	{"Schedule onboarding calls with first 20 customers", [][2]string{
		{"nina", "Booked 11 calls so far. {lisa} could you take the EMEA slots on Thursday?"},
		{"lisa", "Sure, added them to my calendar. I'll share notes in the doc afterwards."},
	}},
	{"Offline sync for task lists", [][2]string{
		{"daniel", "Conflict resolution is the tricky part — proposing last-writer-wins per field. {timmy} thoughts?"},
		{"timmy", "Agreed for text fields. For checklists we should merge item sets instead."},
	}},
	{"Migrate DNS to new provider", [][2]string{
		{"leo", "TTLs lowered to 300s. Cutover planned after the maintenance window."},
	}},
	{"Gather system requirements from Marketing", [][2]string{
		{"jesslyn", "Requirements doc is ready for review. {peter} please sign off when you have a minute."},
	}},
	{"Upgrade PostgreSQL to 16", [][2]string{
		{"michael", "Replica is on 16 and stable for 48h. {daniel} can we schedule the primary switchover?"},
		{"daniel", "Let's do Tuesday 06:00 UTC, lowest traffic."},
	}},
	{"Redesign bottom navigation", [][2]string{
		{"jesslyn", "New prototype uploaded. Feedback welcome before Friday!"},
	}},
}
