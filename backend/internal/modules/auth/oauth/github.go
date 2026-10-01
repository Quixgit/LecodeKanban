package oauth

import (
	"context"
	"strconv"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
)

type GitHub struct{ base }

// NewGitHub requests read-only profile + email scopes for sign-in. Repository access
// is granted later, separately, by the GitHub integration.
func NewGitHub(clientID, secret string) *GitHub {
	return &GitHub{base{name: "github", cfg: oauth2.Config{
		ClientID: clientID, ClientSecret: secret, Endpoint: github.Endpoint,
		Scopes: []string{"read:user", "user:email"},
	}}}
}

func (g *GitHub) Exchange(ctx context.Context, code, verifier, redirectURL string) (domain.ProviderProfile, error) {
	client, err := g.token(ctx, code, verifier, redirectURL)
	if err != nil {
		return domain.ProviderProfile{}, err
	}
	var user struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := getJSON(ctx, client, "https://api.github.com/user", &user); err != nil {
		return domain.ProviderProfile{}, err
	}
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := getJSON(ctx, client, "https://api.github.com/user/emails", &emails); err != nil {
		return domain.ProviderProfile{}, err
	}
	p := domain.ProviderProfile{Provider: "github", ID: strconv.FormatInt(user.ID, 10), Name: user.Name, AvatarURL: user.AvatarURL}
	if p.Name == "" {
		p.Name = user.Login
	}
	for _, e := range emails {
		if e.Primary {
			p.Email, p.EmailVerified = e.Email, e.Verified
		}
	}
	return p, nil
}
