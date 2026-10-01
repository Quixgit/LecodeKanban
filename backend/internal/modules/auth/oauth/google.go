package oauth

import (
	"context"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
)

type Google struct{ base }

// NewGoogle requests only identity scopes (least privilege); Gmail/Calendar scopes
// are requested separately by those integrations.
func NewGoogle(clientID, secret string) *Google {
	return &Google{base{name: "google", cfg: oauth2.Config{
		ClientID: clientID, ClientSecret: secret, Endpoint: google.Endpoint,
		Scopes: []string{"openid", "email", "profile"},
	}}}
}

func (g *Google) Exchange(ctx context.Context, code, verifier, redirectURL string) (domain.ProviderProfile, error) {
	client, err := g.token(ctx, code, verifier, redirectURL)
	if err != nil {
		return domain.ProviderProfile{}, err
	}
	var info struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := getJSON(ctx, client, "https://openidconnect.googleapis.com/v1/userinfo", &info); err != nil {
		return domain.ProviderProfile{}, err
	}
	return domain.ProviderProfile{
		Provider: "google", ID: info.Sub, Email: info.Email, EmailVerified: info.EmailVerified,
		Name: info.Name, AvatarURL: info.Picture,
	}, nil
}
