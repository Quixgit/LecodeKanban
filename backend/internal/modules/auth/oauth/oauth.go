// Package oauth implements sign-in providers (Google, GitHub) behind one interface.
package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
)

// Provider is one OAuth 2.0 sign-in provider using authorization code + PKCE.
type Provider interface {
	Name() string
	AuthCodeURL(state, verifier, redirectURL string) string
	Exchange(ctx context.Context, code, verifier, redirectURL string) (domain.ProviderProfile, error)
}

// Registry holds the configured providers by name.
type Registry map[string]Provider

func (r Registry) Enabled(name string) bool { _, ok := r[name]; return ok }

var httpClient = &http.Client{Timeout: 10 * time.Second}

func getJSON(ctx context.Context, client *http.Client, url string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
		return fmt.Errorf("oauth: GET %s: status %d", url, resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(dst)
}

type base struct {
	name string
	cfg  oauth2.Config
}

func (b *base) Name() string { return b.name }

func (b *base) AuthCodeURL(state, verifier, redirectURL string) string {
	c := b.cfg
	c.RedirectURL = redirectURL
	return c.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
}

func (b *base) token(ctx context.Context, code, verifier, redirectURL string) (*http.Client, error) {
	c := b.cfg
	c.RedirectURL = redirectURL
	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)
	tok, err := c.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, fmt.Errorf("oauth: exchange: %w", err)
	}
	return c.Client(ctx, tok), nil
}
