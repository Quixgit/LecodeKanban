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

	SMTP SMTPConfig

	GoogleClientID     string `env:"LK_GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `env:"LK_GOOGLE_CLIENT_SECRET"`
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

// Redacted returns a log-safe summary of the configuration.
func (c *Config) Redacted() map[string]any {
	return map[string]any{
		"env": c.Env, "http_addr": c.HTTPAddr, "metrics_addr": c.MetricsAddr, "public_url": c.PublicURL,
		"cookie_secure": c.CookieSecure, "embedded_worker": c.EmbeddedWorker,
		"smtp_host": c.SMTP.Host, "smtp_port": c.SMTP.Port, "smtp_tls": c.SMTP.TLS,
		"google_oauth": c.GoogleClientID != "", "github_oauth": c.GitHubClientID != "",
	}
}
