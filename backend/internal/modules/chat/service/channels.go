package service

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// ChannelView is a channel with the caller's state and, for conversations, the other people.
type ChannelView struct {
	domain.ChannelState
	// People are the participants of a direct message (the caller included).
	People      []usersdomain.User
	MemberCount int
}

func (s *Service) viewState(ctx context.Context, states []domain.ChannelState) ([]ChannelView, error) {
	var ids []uuid.UUID
	for _, c := range states {
		ids = append(ids, c.ID)
	}
	members := map[uuid.UUID][]domain.Membership{}
	if len(ids) > 0 {
		var err error
		if members, err = s.repo.MembersOf(ctx, ids); err != nil {
			return nil, err
		}
	}
	var userIDs []uuid.UUID
	for _, c := range states {
		if c.Kind == domain.DM {
			for _, m := range members[c.ID] {
				if !slices.Contains(userIDs, m.UserID) {
					userIDs = append(userIDs, m.UserID)
				}
			}
		}
	}
	people, err := s.people(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelView, len(states))
	for i, c := range states {
		v := ChannelView{ChannelState: c, MemberCount: len(members[c.ID]), People: []usersdomain.User{}}
		if c.Kind == domain.DM {
			for _, m := range members[c.ID] {
				if u, ok := people[m.UserID]; ok {
					v.People = append(v.People, u)
				}
			}
		}
		out[i] = v
	}
	return out, nil
}

// Channels lists what the user can see: every public channel plus their own private ones and DMs.
func (s *Service) Channels(ctx context.Context, user, ws uuid.UUID) ([]ChannelView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	states, err := s.repo.ChannelStates(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	return s.viewState(ctx, states)
}

func (s *Service) channelView(ctx context.Context, user uuid.UUID, ch domain.Channel) (ChannelView, error) {
	states, err := s.repo.ChannelStates(ctx, ch.WorkspaceID, user)
	if err != nil {
		return ChannelView{}, err
	}
	for _, c := range states {
		if c.ID == ch.ID {
			vs, err := s.viewState(ctx, []domain.ChannelState{c})
			if err != nil {
				return ChannelView{}, err
			}
			return vs[0], nil
		}
	}
	return ChannelView{}, apperr.New(domain.ErrNotFound, "not found")
}

type ChannelInput struct {
	Name      string
	Topic     string
	Private   bool
	MemberIDs []uuid.UUID
	// Feed makes it a task feed; FeedProjectID narrows it to one project (nil: all projects).
	Feed          bool
	FeedProjectID *uuid.UUID
}

func validateTopic(v *validation.V, topic string) {
	v.Length("topic", topic, 0, domain.MaxTopicLen)
}

// CreateChannel creates a public or private channel; the creator joins it.
func (s *Service) CreateChannel(ctx context.Context, user, ws uuid.UUID, in ChannelInput) (ChannelView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return ChannelView{}, err
	}
	in.Name = domain.NormalizeName(in.Name)
	var v validation.V
	if !domain.ValidName(in.Name) {
		v.Add("name", validation.ChannelName, nil)
	}
	validateTopic(&v, in.Topic)
	if err := v.Err(); err != nil {
		return ChannelView{}, err
	}
	kind := domain.Public
	if in.Private {
		kind = domain.Private
	}
	invited, err := s.members(ctx, ws, in.MemberIDs)
	if err != nil {
		return ChannelView{}, err
	}
	var feedProject *uuid.UUID
	if in.Feed {
		if feedProject, err = s.feedProject(ctx, ws, in.FeedProjectID); err != nil {
			return ChannelView{}, err
		}
	}
	var created domain.Channel
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		ch, err := r.CreateChannel(ctx, domain.Channel{WorkspaceID: ws, Kind: kind, Name: in.Name, Topic: in.Topic, CreatedBy: &user,
			Feed: in.Feed, FeedProjectID: feedProject})
		if err != nil {
			return err
		}
		created = ch
		for _, id := range append([]uuid.UUID{user}, invited...) {
			if err := r.AddMember(ctx, ch.ID, id); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return ChannelView{}, err
	}
	s.hint(ctx, "chat.channel", ws, user, created.ID, nil)
	return s.channelView(ctx, user, created)
}

// OpenDM returns the direct conversation with the given people (creating it on first use).
// A one-person list is the caller's own notes.
func (s *Service) OpenDM(ctx context.Context, user, ws uuid.UUID, others []uuid.UUID) (ChannelView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return ChannelView{}, err
	}
	ids, err := s.members(ctx, ws, append([]uuid.UUID{user}, others...))
	if err != nil {
		return ChannelView{}, err
	}
	want := slices.Compact(slices.SortedFunc(slices.Values(append([]uuid.UUID{user}, others...)),
		func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) }))
	if len(ids) != len(want) || len(ids) > domain.MaxDMMembers {
		return ChannelView{}, apperr.New(domain.ErrDMMembers, "invalid participants")
	}
	key := domain.DMKey(ids)
	ch, err := s.repo.DMChannel(ctx, ws, key)
	if apperr.IsCode(err, domain.ErrNotFound) {
		err = s.repo.InTx(ctx, func(r *repository.Repo) error {
			c, err := r.CreateChannel(ctx, domain.Channel{WorkspaceID: ws, Kind: domain.DM, DMKey: key, CreatedBy: &user})
			if err != nil {
				return err
			}
			ch = c
			for _, id := range ids {
				if err := r.AddMember(ctx, c.ID, id); err != nil {
					return err
				}
			}
			return nil
		})
		if err == nil {
			s.hint(ctx, "chat.channel", ws, user, ch.ID, nil)
		}
	}
	if err != nil {
		return ChannelView{}, err
	}
	return s.channelView(ctx, user, ch)
}

// ScopeChannel returns the conversation of a project or card, creating it on first use and
// adding the caller. Access follows the target: workspace members who can open it can talk in it.
func (s *Service) ScopeChannel(ctx context.Context, user uuid.UUID, kind domain.Kind, ref uuid.UUID) (ChannelView, error) {
	if !kind.Scoped() || s.projects == nil || s.cards == nil {
		return ChannelView{}, apperr.New(domain.ErrNotFound, "not found")
	}
	var ws uuid.UUID
	if kind == domain.Project {
		p, err := s.projects.Ref(ctx, ref)
		if err != nil {
			return ChannelView{}, err
		}
		if _, err := s.ws.Authorize(ctx, p.WorkspaceID, user, wsdomain.PermView); err != nil {
			return ChannelView{}, apperr.New(projectsdomain.ErrNotFound, "project not found")
		}
		ws = p.WorkspaceID
	} else {
		c, err := s.cards.Ref(ctx, user, ref, wsdomain.PermView)
		if err != nil {
			return ChannelView{}, err
		}
		ws = c.WorkspaceID
	}
	ch, err := s.repo.ScopeChannel(ctx, kind, ref)
	if apperr.IsCode(err, domain.ErrNotFound) {
		ch, err = s.repo.CreateChannel(ctx, domain.Channel{WorkspaceID: ws, Kind: kind, RefID: &ref, CreatedBy: &user})
		if apperr.IsCode(err, domain.ErrNameTaken) { // lost a race with another first visitor
			ch, err = s.repo.ScopeChannel(ctx, kind, ref)
		}
	}
	if err != nil {
		return ChannelView{}, err
	}
	if err := s.repo.AddMember(ctx, ch.ID, user); err != nil {
		return ChannelView{}, err
	}
	return s.scopeView(ctx, user, ch)
}

// scopeView builds the view of a scoped channel, which the channel list never returns.
func (s *Service) scopeView(ctx context.Context, user uuid.UUID, ch domain.Channel) (ChannelView, error) {
	st, err := s.repo.ChannelState(ctx, ch.ID, user)
	if err != nil {
		return ChannelView{}, err
	}
	members, err := s.repo.Members(ctx, ch.ID)
	if err != nil {
		return ChannelView{}, err
	}
	return ChannelView{ChannelState: st, MemberCount: len(members), People: []usersdomain.User{}}, nil
}

// Join adds the caller to a public channel.
func (s *Service) Join(ctx context.Context, user, channel uuid.UUID) (ChannelView, error) {
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return ChannelView{}, err
	}
	if ch.Kind != domain.Public {
		return ChannelView{}, apperr.New(domain.ErrNotFound, "not found")
	}
	if !member {
		if err := s.repo.AddMember(ctx, ch.ID, user); err != nil {
			return ChannelView{}, err
		}
		s.hint(ctx, "chat.channel", ch.WorkspaceID, user, ch.ID, nil)
	}
	return s.channelView(ctx, user, ch)
}

// Leave removes the caller from a public or private channel. Direct messages cannot be left.
func (s *Service) Leave(ctx context.Context, user, channel uuid.UUID) error {
	ch, member, err := s.access(ctx, user, channel, false)
	if err != nil {
		return err
	}
	if ch.Kind == domain.DM || ch.Kind.Scoped() {
		return apperr.New(domain.ErrDMMembers, "cannot leave a conversation")
	}
	if !member {
		return nil
	}
	if err := s.repo.RemoveMember(ctx, ch.ID, user); err != nil {
		return err
	}
	s.hint(ctx, "chat.channel", ch.WorkspaceID, user, ch.ID, nil)
	return nil
}

// AddMembers invites workspace members into a channel the caller belongs to.
func (s *Service) AddMembers(ctx context.Context, user, channel uuid.UUID, ids []uuid.UUID) error {
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return err
	}
	if ch.Kind == domain.DM || ch.Kind.Scoped() {
		return apperr.New(domain.ErrDMMembers, "conversation members are fixed")
	}
	if !member {
		return apperr.New(domain.ErrNotMember, "join the channel first")
	}
	valid, err := s.members(ctx, ch.WorkspaceID, ids)
	if err != nil {
		return err
	}
	for _, id := range valid {
		if err := s.repo.AddMember(ctx, ch.ID, id); err != nil {
			return err
		}
	}
	s.hint(ctx, "chat.channel", ch.WorkspaceID, user, ch.ID, nil)
	return nil
}

// Members lists who is in a channel.
func (s *Service) Members(ctx context.Context, user, channel uuid.UUID) ([]usersdomain.User, error) {
	if _, _, err := s.access(ctx, user, channel, false); err != nil {
		return nil, err
	}
	ms, err := s.repo.Members(ctx, channel)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, len(ms))
	for i, m := range ms {
		ids[i] = m.UserID
	}
	people, err := s.people(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]usersdomain.User, 0, len(ids))
	for _, id := range ids {
		if u, ok := people[id]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

// Update renames a channel or changes its topic; any member may.
// FeedPatch turns a channel's task feed on or off.
type FeedPatch struct {
	On        bool
	ProjectID *uuid.UUID
}

func (s *Service) Update(ctx context.Context, user, channel uuid.UUID, name, topic *string, feed *FeedPatch) (ChannelView, error) {
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return ChannelView{}, err
	}
	if ch.Kind == domain.DM || ch.Kind.Scoped() || !member {
		return ChannelView{}, apperr.New(domain.ErrForbidden, "not allowed")
	}
	newName, newTopic := ch.Name, ch.Topic
	var v validation.V
	if name != nil {
		newName = domain.NormalizeName(*name)
		if !domain.ValidName(newName) {
			v.Add("name", validation.ChannelName, nil)
		}
	}
	if topic != nil {
		newTopic = *topic
		validateTopic(&v, newTopic)
	}
	if err := v.Err(); err != nil {
		return ChannelView{}, err
	}
	updated, err := s.repo.UpdateChannel(ctx, ch.ID, newName, newTopic)
	if err != nil {
		return ChannelView{}, err
	}
	if feed != nil {
		project, err := s.feedProject(ctx, ch.WorkspaceID, feed.ProjectID)
		if err != nil {
			return ChannelView{}, err
		}
		if updated, err = s.repo.SetFeed(ctx, ch.ID, feed.On, project); err != nil {
			return ChannelView{}, err
		}
	}
	s.hint(ctx, "chat.channel", ch.WorkspaceID, user, ch.ID, nil)
	return s.channelView(ctx, user, updated)
}

// Archive hides a channel for everyone; only its creator or a workspace admin may.
func (s *Service) Archive(ctx context.Context, user, channel uuid.UUID) error {
	ch, _, err := s.access(ctx, user, channel, true)
	if err != nil {
		return err
	}
	role, err := s.ws.Authorize(ctx, ch.WorkspaceID, user, wsdomain.PermView)
	if err != nil {
		return err
	}
	creator := ch.CreatedBy != nil && *ch.CreatedBy == user
	if ch.Kind == domain.DM || ch.Kind.Scoped() || !(creator || role.AtLeast(wsdomain.RoleAdmin)) {
		return apperr.New(domain.ErrForbidden, "not allowed")
	}
	if err := s.repo.ArchiveChannel(ctx, ch.ID); err != nil {
		return err
	}
	s.hint(ctx, "chat.channel", ch.WorkspaceID, user, ch.ID, nil)
	return nil
}

// MarkRead clears the caller's unread count up to now.
func (s *Service) MarkRead(ctx context.Context, user, channel uuid.UUID) error {
	ch, member, err := s.access(ctx, user, channel, false)
	if err != nil {
		return err
	}
	if !member {
		return nil
	}
	if err := s.repo.MarkRead(ctx, ch.ID, user); err != nil {
		return err
	}
	s.hint(ctx, "chat.read", ch.WorkspaceID, user, ch.ID, nil)
	return nil
}

// SetMuted silences a channel's unread badge for the caller.
func (s *Service) SetMuted(ctx context.Context, user, channel uuid.UUID, muted bool) error {
	ch, member, err := s.access(ctx, user, channel, false)
	if err != nil {
		return err
	}
	if !member {
		return apperr.New(domain.ErrNotMember, "join the channel first")
	}
	return s.repo.SetMuted(ctx, ch.ID, user, muted)
}
