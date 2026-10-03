// Package config loads and validates 12-factor configuration from the environment.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
)

type Env string

const (
	EnvDevelopment Env = "development"
	EnvProduction  Env = "production"
	EnvTest        Env = "test"
)

// Config is the complete runtime configuration. Secrets are never logged:
// use Redacted() when printing.
type Config struct {
	Env      Env    `env:"LK_ENV" envDefault:"development"`
	LogLevel string `env:"LK_LOG_LEVEL" envDefault:"info"`

	HTTPAddr        string        `env:"LK_HTTP_ADDR" envDefault:":47101"`
	MetricsAddr     string        `env:"LK_METRICS_ADDR" envDefault:"127.0.0.1:47106"`
	PublicURL       string        `env:"LK_PUBLIC_URL" envDefault:"http://localhost:47100"`
	CORSOrigins     []string      `env:"LK_CORS_ORIGINS" envSeparator:","`
	ShutdownTimeout time.Duration `env:"LK_SHUTDOWN_TIMEOUT" envDefault:"15s"`
	// TrustProxy makes the server honour X-Forwarded-For / X-Real-IP (only behind a proxy you control).
	TrustProxy bool `env:"LK_TRUST_PROXY" envDefault:"false"`

	DatabaseURL     string `env:"LK_DATABASE_URL,required,notEmpty"`
	DatabaseMaxConn int32  `env:"LK_DATABASE_MAX_CONNS" envDefault:"20"`

	// SecretKey signs access tokens and OAuth state (base64, ≥32 bytes).
	SecretKey string `env:"LK_SECRET_KEY,required,notEmpty"`
	// EncryptionKey encrypts integration tokens at rest with AES-256-GCM (base64, exactly 32 bytes).
	EncryptionKey string `env:"LK_ENCRYPTION_KEY,required,notEmpty"`

	CookieSecure bool          `env:"LK_COOKIE_SECURE" envDefault:"true"`
	AccessTTL    time.Duration `env:"LK_ACCESS_TTL" envDefault:"15m"`
	RefreshTTL   time.Duration `env:"LK_REFRESH_TTL" envDefault:"720h"`

	EmbeddedWorker bool `env:"LK_EMBEDDED_WORKER" envDefault:"false"`

	// AttachmentsDir holds uploaded files (a named volume in production).
	AttachmentsDir  string `env:"LK_ATTACHMENTS_DIR" envDefault:"./data/attachments"`
	AttachmentMaxMB int    `env:"LK_ATTACHMENT_MAX_MB" envDefault:"25"`

	SMTP SMTPConfig
	Mail MailConfig

	GoogleClientID     string `env:"LK_GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `env:"LK_GOOGLE_CLIENT_SECRET"`
	// Google endpoint overrides point the calendar integration at a stand-in server (tests, local
	// setups); empty keeps Google's own addresses.
	GoogleAuthURL     string `env:"LK_GOOGLE_AUTH_URL"`
	GoogleTokenURL    string `env:"LK_GOOGLE_TOKEN_URL"`
	GoogleUserinfoURL string `env:"LK_GOOGLE_USERINFO_URL"`
	GoogleAPIURL      string `env:"LK_GOOGLE_API_URL"`
	// IntegrationsTick is how often the calendar loop checks for stale syncs and due reminders.
	IntegrationsTick time.Duration `env:"LK_INTEGRATIONS_TICK" envDefault:"30s"`

	// GitHubAPIURL points the GitHub integration at a stand-in server (tests); empty is api.github.com.
	GitHubAPIURL string `env:"LK_GITHUB_API_URL"`

	GitHubClientID     string `env:"LK_GITHUB_CLIENT_ID"`
	GitHubClientSecret string `env:"LK_GITHUB_CLIENT_SECRET"`

	secretKey     []byte
	encryptionKey []byte
}

type SMTPConfig struct {
	Host     string `env:"LK_SMTP_HOST" envDefault:"127.0.0.1"`
	Port     int    `env:"LK_SMTP_PORT" envDefault:"47104"`
	Username string `env:"LK_SMTP_USERNAME"`
	Password string `env:"LK_SMTP_PASSWORD"`
	From     string `env:"LK_SMTP_FROM" envDefault:"LecodeKanban <no-reply@lecodekanban.local>"`
	// TLS: "none" (dev / Mailpit), "starttls" or "tls".
	TLS string `env:"LK_SMTP_TLS" envDefault:"none"`
}

// MailConfig selects how transactional email leaves the server. "smtp" uses LK_SMTP_* (Mailpit in
// development, or any provider's SMTP relay); "mailgun" posts to the Mailgun HTTP API, which works
// from hosts that block outbound SMTP ports.
type MailConfig struct {
	Provider      string `env:"LK_MAIL_PROVIDER" envDefault:"smtp"`
	MailgunAPIKey string `env:"LK_MAILGUN_API_KEY"`
	// MailgunDomain is the sending domain verified in Mailgun, e.g. mg.example.com.
	MailgunDomain string `env:"LK_MAILGUN_DOMAIN"`
	// MailgunRegion is "us" (api.mailgun.net) or "eu" (api.eu.mailgun.net).
	MailgunRegion string `env:"LK_MAILGUN_REGION" envDefault:"us"`
	// MailgunFrom defaults to LK_SMTP_FROM; its address must belong to MailgunDomain.
	MailgunFrom string `env:"LK_MAILGUN_FROM"`
}

// Load parses the environment and validates the result, aggregating every problem
// into one error so misconfiguration is fixed in a single pass.
func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	if err := c.validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *Config) validate() error {
	var errs []error
	switch c.Env {
	case EnvDevelopment, EnvProduction, EnvTest:
	default:
		errs = append(errs, fmt.Errorf("LK_ENV must be development|production|test, got %q", c.Env))
	}
	if u, err := url.Parse(c.PublicURL); err != nil || u.Scheme == "" || u.Host == "" {
		errs = append(errs, fmt.Errorf("LK_PUBLIC_URL must be an absolute URL, got %q", c.PublicURL))
	}
	if !strings.HasPrefix(c.DatabaseURL, "postgres://") && !strings.HasPrefix(c.DatabaseURL, "postgresql://") {
		errs = append(errs, errors.New("LK_DATABASE_URL must be a postgres:// URL"))
	}
	var err error
	if c.secretKey, err = decodeKey(c.SecretKey); err != nil || len(c.secretKey) < 32 {
		errs = append(errs, errors.New("LK_SECRET_KEY must be base64 of at least 32 random bytes (openssl rand -base64 48)"))
	}
	if c.encryptionKey, err = decodeKey(c.EncryptionKey); err != nil || len(c.encryptionKey) != 32 {
		errs = append(errs, errors.New("LK_ENCRYPTION_KEY must be base64 of exactly 32 bytes (openssl rand -base64 32)"))
	}
	if c.AccessTTL < time.Minute || c.AccessTTL > time.Hour {
		errs = append(errs, errors.New("LK_ACCESS_TTL must be between 1m and 1h"))
	}
	if c.AttachmentMaxMB < 1 || c.AttachmentMaxMB > 200 {
		errs = append(errs, errors.New("LK_ATTACHMENT_MAX_MB must be between 1 and 200"))
	}
	if strings.TrimSpace(c.AttachmentsDir) == "" {
		errs = append(errs, errors.New("LK_ATTACHMENTS_DIR must not be empty"))
	}
	if c.RefreshTTL < time.Hour {
		errs = append(errs, errors.New("LK_REFRESH_TTL must be at least 1h"))
	}
	switch c.SMTP.TLS {
	case "none", "starttls", "tls":
	default:
		errs = append(errs, errors.New("LK_SMTP_TLS must be none|starttls|tls"))
	}
	if c.Env == EnvProduction && c.SMTP.TLS == "none" && c.SMTP.Username != "" {
		errs = append(errs, errors.New("refusing to send SMTP credentials without TLS in production"))
	}
	switch c.Mail.Provider {
	case "smtp":
	case "mailgun":
		if c.Mail.MailgunAPIKey == "" || c.Mail.MailgunDomain == "" {
			errs = append(errs, errors.New("LK_MAIL_PROVIDER=mailgun needs LK_MAILGUN_API_KEY and LK_MAILGUN_DOMAIN"))
		}
		if c.Mail.MailgunRegion != "us" && c.Mail.MailgunRegion != "eu" {
			errs = append(errs, errors.New("LK_MAILGUN_REGION must be us|eu"))
		}
	default:
		errs = append(errs, errors.New("LK_MAIL_PROVIDER must be smtp|mailgun"))
	}
	if (c.GoogleClientID == "") != (c.GoogleClientSecret == "") {
		errs = append(errs, errors.New("set both LK_GOOGLE_CLIENT_ID and LK_GOOGLE_CLIENT_SECRET, or neither"))
	}
	if (c.GitHubClientID == "") != (c.GitHubClientSecret == "") {
		errs = append(errs, errors.New("set both LK_GITHUB_CLIENT_ID and LK_GITHUB_CLIENT_SECRET, or neither"))
	}
	if len(errs) > 0 {
		return fmt.Errorf("invalid configuration:\n  - %w", joinIndented(errs))
	}
	return nil
}

func decodeKey(s string) ([]byte, error) {
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.RawURLEncoding.DecodeString(s)
}

func joinIndented(errs []error) error {
	parts := make([]string, len(errs))
	for i, e := range errs {
		parts[i] = e.Error()
	}
	return errors.New(strings.Join(parts, "\n  - "))
}

func (c *Config) SecretKeyBytes() []byte     { return c.secretKey }
func (c *Config) EncryptionKeyBytes() []byte { return c.encryptionKey }
func (c *Config) IsProduction() bool         { return c.Env == EnvProduction }

// AttachmentMaxBytes is the per-file upload limit.
func (c *Config) AttachmentMaxBytes() int64 { return int64(c.AttachmentMaxMB) << 20 }

// Redacted returns a log-safe summary of the configuration.
func (c *Config) Redacted() map[string]any {
	return map[string]any{
		"env": c.Env, "http_addr": c.HTTPAddr, "metrics_addr": c.MetricsAddr, "public_url": c.PublicURL,
		"cookie_secure": c.CookieSecure, "embedded_worker": c.EmbeddedWorker,
		"mail_provider": c.Mail.Provider, "smtp_host": c.SMTP.Host, "smtp_port": c.SMTP.Port, "smtp_tls": c.SMTP.TLS,
		"google_oauth": c.GoogleClientID != "", "github_oauth": c.GitHubClientID != "",
	}
}
