package service_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func mention(name string, id uuid.UUID) string { return "@[" + name + "](" + id.String() + ")" }

type world struct {
	e                                  *testkit.Env
	ws                                 uuid.UUID
	owner, anna, ben, viewer, outsider uuid.UUID
}

func setup(t *testing.T) world {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	w := world{e: e}
	w.owner = e.User("Olena Owner", "o@example.com")
	w.anna = e.User("Anna Member", "a@example.com")
	w.ben = e.User("Ben Member", "b@example.com")
	w.viewer = e.User("Vira Viewer", "v@example.com")
	w.outsider = e.User("Out Sider", "x@example.com")
	w.ws = e.Workspace(w.owner, map[uuid.UUID]wsdomain.Role{
		w.anna: wsdomain.RoleMember, w.ben: wsdomain.RoleMember, w.viewer: wsdomain.RoleViewer}, tdb.Pool)
	return w
}

func TestChannelsAndAccess(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat

	pub, err := c.CreateChannel(ctx, w.anna, w.ws, chatInput("  General Chat ", false))
	if err != nil || pub.Name != "general-chat" || !pub.Joined || pub.MemberCount != 1 {
		t.Fatalf("create: %+v %v", pub, err)
	}
	_, err = c.CreateChannel(ctx, w.ben, w.ws, chatInput("general-chat", false))
	mustCode(t, err, domain.ErrNameTaken)
	_, err = c.CreateChannel(ctx, w.ben, w.ws, chatInput("bad name!", false))
	mustCode(t, err, apperr.Validation)
	_, err = c.CreateChannel(ctx, w.viewer, w.ws, chatInput("viewers", false))
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	priv, err := c.CreateChannel(ctx, w.anna, w.ws, chatInput("secret", true))
	if err != nil {
		t.Fatal(err)
	}

	// Ben sees the public channel (not joined) but not the private one, and cannot even probe it.
	list, _ := c.Channels(ctx, w.ben, w.ws)
	if len(list) != 1 || list[0].ID != pub.ID || list[0].Joined {
		t.Fatalf("ben sees %+v", list)
	}
	_, err = c.Messages(ctx, w.ben, priv.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)
	_, err = c.Post(ctx, w.ben, priv.ID, nil, "let me in", nil)
	mustCode(t, err, domain.ErrNotFound)
	_, err = c.Join(ctx, w.ben, priv.ID)
	mustCode(t, err, domain.ErrNotFound)
	// Outsiders (not in the workspace) get nothing at all.
	_, err = c.Messages(ctx, w.outsider, pub.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)

	// Posting in a public channel joins it; viewers can read but not write.
	if _, err := c.Post(ctx, w.ben, pub.ID, nil, "hello", nil); err != nil {
		t.Fatal(err)
	}
	list, _ = c.Channels(ctx, w.ben, w.ws)
	if !list[0].Joined || list[0].MemberCount != 2 {
		t.Fatalf("auto-join failed: %+v", list[0])
	}
	if _, err := c.Messages(ctx, w.viewer, pub.ID, nil, 0); err != nil {
		t.Fatal(err)
	}
	_, err = c.Post(ctx, w.viewer, pub.ID, nil, "nope", nil)
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	// Private channels need an invitation from a member.
	mustCode(t, c.AddMembers(ctx, w.ben, priv.ID, []uuid.UUID{w.ben}), domain.ErrNotFound)
	if err := c.AddMembers(ctx, w.anna, priv.ID, []uuid.UUID{w.ben, w.outsider}); err != nil {
		t.Fatal(err)
	}
	ms, _ := c.Members(ctx, w.anna, priv.ID)
	if len(ms) != 2 { // the outsider is not in the workspace and was dropped
		t.Fatalf("members = %d", len(ms))
	}
	if err := c.Leave(ctx, w.ben, priv.ID); err != nil {
		t.Fatal(err)
	}
	_, err = c.Messages(ctx, w.ben, priv.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)

	// Only the creator or an admin archives; archived channels vanish from lists.
	mustCode(t, c.Archive(ctx, w.ben, pub.ID), domain.ErrForbidden)
	if err := c.Archive(ctx, w.owner, pub.ID); err != nil {
		t.Fatal(err)
	}
	list, _ = c.Channels(ctx, w.ben, w.ws)
	if len(list) != 0 {
		t.Fatalf("archived channel still listed: %+v", list)
	}
}

func TestDirectMessages(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat

	dm, err := c.OpenDM(ctx, w.anna, w.ws, []uuid.UUID{w.ben})
	if err != nil || dm.Kind != domain.DM || len(dm.People) != 2 {
		t.Fatalf("dm: %+v %v", dm, err)
	}
	again, _ := c.OpenDM(ctx, w.ben, w.ws, []uuid.UUID{w.anna})
	if again.ID != dm.ID {
		t.Fatal("the same pair must share one conversation")
	}
	self, err := c.OpenDM(ctx, w.anna, w.ws, nil)
	if err != nil || self.ID == dm.ID || len(self.People) != 1 {
		t.Fatalf("notes to self: %+v %v", self, err)
	}
	group, err := c.OpenDM(ctx, w.anna, w.ws, []uuid.UUID{w.ben, w.owner})
	if err != nil || len(group.People) != 3 {
		t.Fatalf("group: %+v %v", group, err)
	}
	_, err = c.OpenDM(ctx, w.anna, w.ws, []uuid.UUID{w.outsider})
	mustCode(t, err, domain.ErrDMMembers)

	// Only participants can read it; nobody can leave or add people.
	_, err = c.Messages(ctx, w.owner, dm.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)
	mustCode(t, c.Leave(ctx, w.anna, dm.ID), domain.ErrDMMembers)
	mustCode(t, c.AddMembers(ctx, w.anna, dm.ID, []uuid.UUID{w.owner}), domain.ErrDMMembers)
}

func TestMessagesThreadsReactionsAndUnread(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	ch, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("dev", false))
	if _, err := c.Join(ctx, w.ben, ch.ID); err != nil {
		t.Fatal(err)
	}

	first, err := c.Post(ctx, w.anna, ch.ID, nil, "  first with "+mention("Ben", w.ben)+"  ", nil)
	if err != nil || len(first.Mentioned) != 1 || first.Author == nil || strings.HasPrefix(first.Body, " ") {
		t.Fatalf("post: %+v %v", first, err)
	}
	_, err = c.Post(ctx, w.anna, ch.ID, nil, "   ", nil)
	mustCode(t, err, apperr.Validation)
	_, err = c.Post(ctx, w.anna, ch.ID, nil, strings.Repeat("x", domain.MaxBodyLen+1), nil)
	mustCode(t, err, apperr.Validation)

	// Ben has one unread message that mentions him; Anna's own message never counts for her.
	states, _ := c.Channels(ctx, w.ben, w.ws)
	if states[0].Unread != 1 || states[0].Mentions != 1 {
		t.Fatalf("ben unread = %d/%d", states[0].Unread, states[0].Mentions)
	}
	states, _ = c.Channels(ctx, w.anna, w.ws)
	if states[0].Unread != 0 {
		t.Fatalf("author unread = %d", states[0].Unread)
	}
	if err := c.MarkRead(ctx, w.ben, ch.ID); err != nil {
		t.Fatal(err)
	}
	states, _ = c.Channels(ctx, w.ben, w.ws)
	if states[0].Unread != 0 || states[0].Mentions != 0 {
		t.Fatalf("after read: %d/%d", states[0].Unread, states[0].Mentions)
	}

	// Threads are one level deep and tracked on the root.
	r1, err := c.Post(ctx, w.ben, ch.ID, &first.ID, "reply", nil)
	if err != nil || r1.ParentID == nil {
		t.Fatalf("reply: %+v %v", r1, err)
	}
	_, err = c.Post(ctx, w.anna, ch.ID, &r1.ID, "reply to reply", nil)
	mustCode(t, err, domain.ErrThreadDeep)
	other, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("ops", false))
	_, err = c.Post(ctx, w.anna, other.ID, &first.ID, "wrong channel", nil)
	mustCode(t, err, domain.ErrNotFound)
	page, _ := c.Messages(ctx, w.anna, ch.ID, nil, 0)
	if len(page.Messages) != 1 || page.Messages[0].ReplyCount != 1 || page.Messages[0].LastReplyAt == nil {
		t.Fatalf("root summary: %+v", page.Messages)
	}
	thread, err := c.Thread(ctx, w.anna, first.ID)
	if err != nil || len(thread) != 2 || thread[0].ID != first.ID {
		t.Fatalf("thread: %d %v", len(thread), err)
	}
	if _, err := c.Thread(ctx, w.anna, r1.ID); err == nil {
		t.Fatal("a reply is not a thread root")
	}

	// Reactions: a closed set, one per person and key, toggled both ways.
	_, err = c.React(ctx, w.anna, first.ID, "boom", true)
	mustCode(t, err, domain.ErrBadReact)
	v, err := c.React(ctx, w.anna, first.ID, "heart", true)
	if err != nil || len(v.Reactions) != 1 || !v.Reactions[0].Mine {
		t.Fatalf("react: %+v %v", v.Reactions, err)
	}
	_, _ = c.React(ctx, w.anna, first.ID, "heart", true) // idempotent
	v, _ = c.React(ctx, w.ben, first.ID, "heart", true)
	if v.Reactions[0].Count != 2 {
		t.Fatalf("count = %d", v.Reactions[0].Count)
	}
	v, _ = c.React(ctx, w.ben, first.ID, "heart", false)
	if v.Reactions[0].Count != 1 || v.Reactions[0].Mine {
		t.Fatalf("after removal: %+v", v.Reactions)
	}

	// Edit: author only; delete: author or admin, leaving a tombstone and fixing the counter.
	_, err = c.Edit(ctx, w.ben, first.ID, "hijack")
	mustCode(t, err, domain.ErrForbidden)
	ed, err := c.Edit(ctx, w.anna, first.ID, "edited")
	if err != nil || ed.EditedAt == nil || ed.Body != "edited" || len(ed.Mentioned) != 0 {
		t.Fatalf("edit: %+v %v", ed, err)
	}
	mustCode(t, c.Delete(ctx, w.ben, first.ID), domain.ErrForbidden)
	if err := c.Delete(ctx, w.ben, r1.ID); err != nil {
		t.Fatal(err)
	}
	if err := c.Delete(ctx, w.owner, first.ID); err != nil { // admins may moderate
		t.Fatal(err)
	}
	page, _ = c.Messages(ctx, w.anna, ch.ID, nil, 0)
	if len(page.Messages) != 1 || !page.Messages[0].Deleted() || page.Messages[0].Body != "" || page.Messages[0].ReplyCount != 0 {
		t.Fatalf("tombstone: %+v", page.Messages)
	}
	_, err = c.Edit(ctx, w.anna, first.ID, "again")
	mustCode(t, err, domain.ErrDeleted)
	_, err = c.Post(ctx, w.anna, ch.ID, &first.ID, "reply to deleted", nil)
	mustCode(t, err, domain.ErrDeleted)
}

func TestHistoryPagination(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	ch, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("log", false))
	var ids []uuid.UUID
	for i := 0; i < 7; i++ {
		m, err := c.Post(ctx, w.anna, ch.ID, nil, "m"+string(rune('0'+i)), nil)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, m.ID)
	}
	p1, _ := c.Messages(ctx, w.anna, ch.ID, nil, 3)
	if len(p1.Messages) != 3 || !p1.HasMore || p1.Messages[2].ID != ids[6] || p1.Messages[0].ID != ids[4] {
		t.Fatalf("page 1: %+v", p1)
	}
	p2, _ := c.Messages(ctx, w.anna, ch.ID, &p1.Messages[0].ID, 3)
	if len(p2.Messages) != 3 || !p2.HasMore || p2.Messages[2].ID != ids[3] {
		t.Fatalf("page 2: %+v", p2)
	}
	p3, _ := c.Messages(ctx, w.anna, ch.ID, &p2.Messages[0].ID, 3)
	if len(p3.Messages) != 1 || p3.HasMore || p3.Messages[0].ID != ids[0] {
		t.Fatalf("page 3: %+v", p3)
	}
}

func TestChangeHints(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	ch, _ := w.e.Chat.CreateChannel(ctx, w.anna, w.ws, chatInput("hints", false))
	_ = w.e.Hints.Types()
	m, _ := w.e.Chat.Post(ctx, w.anna, ch.ID, nil, "ping", nil)
	_, _ = w.e.Chat.React(ctx, w.anna, m.ID, "check", true)
	got := strings.Join(w.e.Hints.Types(), ",")
	if got != "chat.message,chat.message" {
		t.Fatalf("hints = %s", got)
	}
}

func chatInput(name string, private bool) service.ChannelInput {
	return service.ChannelInput{Name: name, Private: private}
}

func TestProjectAndCardConversations(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	project := w.e.Project(w.owner, w.ws, "Core")
	card := w.e.Card(w.anna, w.ws, project, "Fix login")

	pc, err := c.ScopeChannel(ctx, w.anna, domain.Project, project)
	if err != nil || pc.Kind != domain.Project || pc.Name != "" || !pc.Joined {
		t.Fatalf("project chat: %+v %v", pc, err)
	}
	again, _ := c.ScopeChannel(ctx, w.ben, domain.Project, project)
	if again.ID != pc.ID || again.MemberCount != 2 {
		t.Fatalf("one conversation per project, joined on open: %+v", again)
	}
	cc, err := c.ScopeChannel(ctx, w.ben, domain.Card, card.ID)
	if err != nil || cc.ID == pc.ID || cc.Kind != domain.Card {
		t.Fatalf("card chat: %+v %v", cc, err)
	}

	// They never show up in the channel list or the directory.
	list, _ := c.Channels(ctx, w.anna, w.ws)
	if len(list) != 0 {
		t.Fatalf("scoped conversations leaked into the list: %+v", list)
	}

	// Talking works for editors; viewers read; outsiders and strangers get nothing.
	if _, err := c.Post(ctx, w.anna, pc.ID, nil, "kickoff", nil); err != nil {
		t.Fatal(err)
	}
	st, _ := c.ScopeChannel(ctx, w.ben, domain.Project, project)
	if st.Unread != 1 {
		t.Fatalf("unread = %d", st.Unread)
	}
	if _, err := c.Messages(ctx, w.viewer, pc.ID, nil, 0); err != nil {
		t.Fatal(err)
	}
	_, err = c.Post(ctx, w.viewer, pc.ID, nil, "nope", nil)
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = c.Messages(ctx, w.outsider, pc.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)
	_, err = c.ScopeChannel(ctx, w.outsider, domain.Project, project)
	if err == nil {
		t.Fatal("outsiders must not open a project conversation")
	}
	_, err = c.ScopeChannel(ctx, w.ben, domain.Card, uuid.New())
	if err == nil {
		t.Fatal("unknown card")
	}

	// Their shape is fixed.
	mustCode(t, c.Leave(ctx, w.anna, pc.ID), domain.ErrDMMembers)
	mustCode(t, c.Archive(ctx, w.owner, pc.ID), domain.ErrForbidden)
	_, err = c.Update(ctx, w.anna, pc.ID, nil, nil)
	mustCode(t, err, domain.ErrForbidden)
}

func upload(t *testing.T, w world, user, channel uuid.UUID, name, content string) domain.File {
	t.Helper()
	f, err := w.e.Chat.UploadFile(context.Background(), user, channel, name, strings.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func TestAttachments(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	ch, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("files", false))
	_, _ = c.Join(ctx, w.ben, ch.ID)
	priv, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("vault", true))

	png := "\x89PNG\r\n\x1a\n" + strings.Repeat("x", 32)
	f := upload(t, w, w.anna, ch.ID, `..\evil/"report".png`, png)
	if f.ContentType != "image/png" || strings.ContainsAny(f.Name, `/\"`) {
		t.Fatalf("sniffed type and clean name expected: %+v", f)
	}
	script := upload(t, w, w.anna, ch.ID, "x.png", "<script>alert(1)</script>")
	if script.ContentType == "image/png" {
		t.Fatalf("type must come from the bytes, got %s", script.ContentType)
	}

	// Unsent uploads are private to the uploader; nobody can attach somebody else's file.
	if _, _, err := c.OpenFile(ctx, w.ben, f.ID); err == nil {
		t.Fatal("an unsent upload must not be readable by others")
	}
	_, err := c.Post(ctx, w.ben, ch.ID, nil, "stolen", []uuid.UUID{f.ID})
	mustCode(t, err, domain.ErrNoFile)

	// A message may be only files; the file is then readable by channel members and listed.
	m, err := c.Post(ctx, w.anna, ch.ID, nil, "  ", []uuid.UUID{f.ID})
	if err != nil || len(m.Files) != 1 || m.Files[0].ID != f.ID || m.Body != "" {
		t.Fatalf("file-only message: %+v %v", m, err)
	}
	if _, rc, err := c.OpenFile(ctx, w.ben, f.ID); err != nil {
		t.Fatal(err)
	} else {
		_ = rc.Close()
	}
	files, _ := c.ChannelFiles(ctx, w.ben, ch.ID)
	if len(files) != 1 {
		t.Fatalf("channel files = %d", len(files))
	}
	_, err = c.Post(ctx, w.anna, ch.ID, nil, "", nil)
	mustCode(t, err, apperr.Validation)
	_, err = c.Post(ctx, w.anna, ch.ID, nil, "again", []uuid.UUID{f.ID})
	mustCode(t, err, domain.ErrNoFile) // already attached

	// Files of a private channel are invisible outside it, and cannot cross channels.
	pf := upload(t, w, w.anna, priv.ID, "secret.txt", "classified")
	_, err = c.Post(ctx, w.anna, ch.ID, nil, "wrong place", []uuid.UUID{pf.ID})
	mustCode(t, err, domain.ErrNoFile)
	if _, err := c.Post(ctx, w.anna, priv.ID, nil, "see file", []uuid.UUID{pf.ID}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := c.OpenFile(ctx, w.ben, pf.ID); err == nil {
		t.Fatal("a private channel's file must stay private")
	}
	_, err = c.UploadFile(ctx, w.viewer, ch.ID, "v.txt", strings.NewReader("x"))
	mustCode(t, err, wsdomain.ErrInsufficientRole)
}

func TestStarsSavedPinsAndLists(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	ch, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("ideas", false))
	_, _ = c.Join(ctx, w.ben, ch.ID)
	other, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("misc", false))

	if err := c.Star(ctx, w.ben, ch.ID, true); err != nil {
		t.Fatal(err)
	}
	list, _ := c.Channels(ctx, w.ben, w.ws)
	for _, x := range list {
		if x.Starred != (x.ID == ch.ID) {
			t.Fatalf("starred flags: %+v", list)
		}
	}
	first, _ := c.Post(ctx, w.anna, ch.ID, nil, "Release plan for the quarter", nil)
	_, _ = c.Post(ctx, w.anna, other.ID, nil, "lunch plan", nil)
	reply, _ := c.Post(ctx, w.ben, ch.ID, &first.ID, "looks good", nil)

	// Saved is personal and survives in the list; pins are shared and top-level only.
	v, err := c.Save(ctx, w.ben, first.ID, true)
	if err != nil || !v.Saved {
		t.Fatalf("save: %+v %v", v, err)
	}
	saved, _ := c.Saved(ctx, w.ben, w.ws)
	if len(saved) != 1 || saved[0].ID != first.ID || saved[0].Channel.ID != ch.ID {
		t.Fatalf("saved list: %+v", saved)
	}
	if other, _ := c.Saved(ctx, w.anna, w.ws); len(other) != 0 {
		t.Fatal("saved items are personal")
	}
	pv, err := c.Pin(ctx, w.ben, first.ID, true)
	if err != nil || !pv.Pinned {
		t.Fatalf("pin: %+v %v", pv, err)
	}
	if _, err := c.Pin(ctx, w.ben, reply.ID, true); err == nil {
		t.Fatal("replies cannot be pinned")
	}
	pins, _ := c.Pins(ctx, w.anna, ch.ID)
	if len(pins) != 1 || !pins[0].Pinned {
		t.Fatalf("pins: %+v", pins)
	}
	if _, err := c.Pin(ctx, w.ben, first.ID, false); err != nil {
		t.Fatal(err)
	}
	if pins, _ = c.Pins(ctx, w.anna, ch.ID); len(pins) != 0 {
		t.Fatal("unpin")
	}

	// Threads: both the author of the root and the replier see it; a bystander does not.
	for _, u := range []uuid.UUID{w.anna, w.ben} {
		th, _ := c.Threads(ctx, u, w.ws)
		if len(th) != 1 || th[0].ID != first.ID || th[0].ReplyCount != 1 || len(th[0].ReplyPeople) != 1 {
			t.Fatalf("threads for %v: %+v", u, th)
		}
	}
	if th, _ := c.Threads(ctx, w.owner, w.ws); len(th) != 0 {
		t.Fatal("bystanders have no threads")
	}

	// Search sees what the caller can see, ignores wildcards, and needs two characters.
	hits, _ := c.Search(ctx, w.ben, w.ws, "plan")
	if len(hits) != 2 {
		t.Fatalf("search plan = %d", len(hits))
	}
	if hits, _ = c.Search(ctx, w.ben, w.ws, "%"); len(hits) != 0 {
		t.Fatal("wildcards must be literal")
	}
	if hits, _ = c.Search(ctx, w.ben, w.ws, "p"); len(hits) != 0 {
		t.Fatal("one character is too short")
	}
	priv, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("hidden", true))
	_, _ = c.Post(ctx, w.anna, priv.ID, nil, "plan for layoffs", nil)
	if hits, _ = c.Search(ctx, w.ben, w.ws, "layoffs"); len(hits) != 0 {
		t.Fatal("search must not leak private channels")
	}
	if hits, _ = c.Search(ctx, w.anna, w.ws, "layoffs"); len(hits) != 1 {
		t.Fatal("members find their private messages")
	}
}

func TestMentionAllAndPresence(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat
	ch, _ := c.CreateChannel(ctx, w.anna, w.ws, chatInput("announce", false))
	_, _ = c.Join(ctx, w.ben, ch.ID)
	m, _ := c.Post(ctx, w.anna, ch.ID, nil, "@channel deploy at noon", nil)
	if !m.MentionAll {
		t.Fatal("@channel must set mentionAll")
	}
	st, _ := c.Channels(ctx, w.ben, w.ws)
	if st[0].Unread != 1 || st[0].Mentions != 1 {
		t.Fatalf("@channel counts as a mention: %d/%d", st[0].Unread, st[0].Mentions)
	}
	_, _ = c.Post(ctx, w.anna, ch.ID, nil, "mail a@channel.com", nil)
	st, _ = c.Channels(ctx, w.ben, w.ws)
	if st[0].Mentions != 1 {
		t.Fatalf("an email address is not a mention: %d", st[0].Mentions)
	}

	if err := c.Heartbeat(ctx, w.anna, w.ws); err != nil {
		t.Fatal(err)
	}
	online, _ := c.Online(ctx, w.ben, w.ws)
	if len(online) != 1 || online[0] != w.anna {
		t.Fatalf("online = %v", online)
	}
	if _, err := c.Online(ctx, w.outsider, w.ws); err == nil {
		t.Fatal("outsiders cannot see presence")
	}
	_ = w.e.Hints.Types()
	if err := c.Typing(ctx, w.anna, ch.ID); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(w.e.Hints.Types(), ","); got != "chat.typing" {
		t.Fatalf("typing hint = %q", got)
	}
}
