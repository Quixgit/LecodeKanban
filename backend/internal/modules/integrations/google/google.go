// Package google talks to Google Calendar for the integrations module: OAuth with offline access,
// then read-only event listing.
package google

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
	googleoauth "golang.org/x/oauth2/google"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
)

// Endpoints override Google's URLs (empty keeps the default). They exist so tests and local setups can
// point the integration at a stand-in server.
type Endpoints struct{ Auth, Token, Userinfo, API string }

// ErrReauth is domain.ErrReauth: the stored grant was revoked or expired.
var ErrReauth = domain.ErrReauth

// Scopes are the least needed: read events, and know which account it is.
var Scopes = []string{"openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly"}

type Client struct {
	cfg      oauth2.Config
	userinfo string
	api      string
	http     *http.Client
}

func New(clientID, secret string, ep Endpoints) *Client {
	endpoint := googleoauth.Endpoint
	if ep.Auth != "" {
		endpoint.AuthURL = ep.Auth
	}
	if ep.Token != "" {
		endpoint.TokenURL = ep.Token
	}
	c := &Client{cfg: oauth2.Config{ClientID: clientID, ClientSecret: secret, Endpoint: endpoint, Scopes: Scopes},
		userinfo: "https://openidconnect.googleapis.com/v1/userinfo", api: "https://www.googleapis.com",
		http: &http.Client{Timeout: 15 * time.Second}}
	if ep.Userinfo != "" {
		c.userinfo = ep.Userinfo
	}
	if ep.API != "" {
		c.api = strings.TrimRight(ep.API, "/")
	}
	return c
}

// Configured reports whether the server has Google credentials at all.
func (c *Client) Configured() bool { return c != nil && c.cfg.ClientID != "" }

func (c *Client) AuthURL(state, redirect string) string {
	cfg := c.cfg
	cfg.RedirectURL = redirect
	return cfg.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"))
}

func (c *Client) ctx(ctx context.Context) context.Context {
	return context.WithValue(ctx, oauth2.HTTPClient, c.http)
}

// Exchange trades the authorisation code for a refresh token and finds out the account's address.
func (c *Client) Exchange(ctx context.Context, code, redirect string) (token, email string, err error) {
	cfg := c.cfg
	cfg.RedirectURL = redirect
	tok, err := cfg.Exchange(c.ctx(ctx), code)
	if err != nil {
		return "", "", fmt.Errorf("google: exchange: %w", err)
	}
	if tok.RefreshToken == "" {
		return "", "", errors.New("google: no refresh token returned")
	}
	var info struct {
		Email string `json:"email"`
	}
	if err := c.getJSON(ctx, cfg.Client(c.ctx(ctx), tok), c.userinfo, &info); err != nil {
		return "", "", err
	}
	return tok.RefreshToken, info.Email, nil
}

func (c *Client) getJSON(ctx context.Context, client *http.Client, u string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
		return ErrReauth
	}
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
		return fmt.Errorf("google: GET status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(dst)
}

type apiEvent struct {
	ID             string `json:"id"`
	Status         string `json:"status"`
	Summary        string `json:"summary"`
	Location       string `json:"location"`
	HTMLLink       string `json:"htmlLink"`
	HangoutLink    string `json:"hangoutLink"`
	ConferenceData struct {
		EntryPoints []struct {
			Type string `json:"entryPointType"`
			URI  string `json:"uri"`
		} `json:"entryPoints"`
	} `json:"conferenceData"`
	Start     apiTime `json:"start"`
	End       apiTime `json:"end"`
	Attendees []struct {
		Email          string `json:"email"`
		Self           bool   `json:"self"`
		Resource       bool   `json:"resource"`
		ResponseStatus string `json:"responseStatus"`
	} `json:"attendees"`
}

type apiTime struct {
	DateTime string `json:"dateTime"`
	Date     string `json:"date"`
}

func (t apiTime) parse() (time.Time, bool, error) {
	if t.DateTime != "" {
		v, err := time.Parse(time.RFC3339, t.DateTime)
		return v, false, err
	}
	v, err := time.Parse("2006-01-02", t.Date)
	return v, true, err
}

// Events lists the primary calendar's events between from and to (recurring ones expanded),
// without cancelled events or ones the person declined.
func (c *Client) Events(ctx context.Context, refreshToken string, from, to time.Time) ([]domain.Event, error) {
	src := c.cfg.TokenSource(c.ctx(ctx), &oauth2.Token{RefreshToken: refreshToken})
	if _, err := src.Token(); err != nil {
		var re *oauth2.RetrieveError
		if errors.As(err, &re) && (re.ErrorCode == "invalid_grant" || re.Response != nil && re.Response.StatusCode == http.StatusBadRequest) {
			return nil, ErrReauth
		}
		return nil, fmt.Errorf("google: token: %w", err)
	}
	client := oauth2.NewClient(c.ctx(ctx), src)
	q := url.Values{
		"timeMin": {from.UTC().Format(time.RFC3339)}, "timeMax": {to.UTC().Format(time.RFC3339)},
		"singleEvents": {"true"}, "orderBy": {"startTime"}, "maxResults": {"100"},
	}
	var page struct {
		Items []apiEvent `json:"items"`
	}
	if err := c.getJSON(ctx, client, c.api+"/calendar/v3/calendars/primary/events?"+q.Encode(), &page); err != nil {
		return nil, err
	}
	var out []domain.Event
	for _, e := range page.Items {
		if e.Status == "cancelled" || e.ID == "" {
			continue
		}
		start, allDay, err := e.Start.parse()
		if err != nil {
			continue
		}
		end, _, err := e.End.parse()
		if err != nil {
			end = start
		}
		declined := false
		emails := []string{}
		for _, a := range e.Attendees {
			if a.Self && a.ResponseStatus == "declined" {
				declined = true
			}
			if a.Email != "" && !a.Resource {
				emails = append(emails, strings.ToLower(a.Email))
			}
		}
		if declined {
			continue
		}
		join := e.HangoutLink
		for _, p := range e.ConferenceData.EntryPoints {
			if p.Type == "video" && p.URI != "" {
				join = p.URI
				break
			}
		}
		title := strings.TrimSpace(e.Summary)
		if title == "" {
			title = "(no title)"
		}
		out = append(out, domain.Event{RemoteID: e.ID, Title: title, StartsAt: start, EndsAt: end, AllDay: allDay,
			Location: e.Location, Link: e.HTMLLink, JoinURL: join, Attendees: emails})
	}
	return out, nil
}
