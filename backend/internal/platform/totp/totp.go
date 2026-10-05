// Package totp implements time-based one-time passwords (RFC 6238, as used by authenticator apps):
// HMAC-SHA1, 6 digits, 30-second steps.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec // RFC 6238 authenticator apps use HMAC-SHA1
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	Digits = 6
	Period = 30 // seconds
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewSecret returns a random 160-bit secret, base32 encoded (the form authenticator apps take).
func NewSecret() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return b32.EncodeToString(b), nil
}

func hotp(key []byte, counter uint64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	n := (uint32(sum[off])&0x7f)<<24 | uint32(sum[off+1])<<16 | uint32(sum[off+2])<<8 | uint32(sum[off+3])
	return fmt.Sprintf("%0*d", Digits, n%1_000_000)
}

// Counter is the 30-second step number of t.
func Counter(t time.Time) int64 { return t.Unix() / Period }

// Code returns the code valid at t for a base32 secret.
func Code(secret string, t time.Time) (string, error) {
	key, err := b32.DecodeString(strings.ToUpper(strings.ReplaceAll(secret, " ", "")))
	if err != nil {
		return "", err
	}
	return hotp(key, uint64(Counter(t))), nil
}

// Verify checks a code against the steps around t (one step either way, for clock drift) and returns the
// matching step so the caller can refuse to accept the same step twice.
func Verify(secret, code string, t time.Time) (int64, bool) {
	code = strings.ReplaceAll(strings.TrimSpace(code), " ", "")
	if len(code) != Digits {
		return 0, false
	}
	key, err := b32.DecodeString(strings.ToUpper(secret))
	if err != nil {
		return 0, false
	}
	c := Counter(t)
	for _, d := range []int64{0, -1, 1} {
		step := c + d
		if step < 0 {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(hotp(key, uint64(step))), []byte(code)) == 1 {
			return step, true
		}
	}
	return 0, false
}

// URI is the otpauth:// address an authenticator app scans as a QR code.
func URI(issuer, account, secret string) string {
	label := url.PathEscape(issuer) + ":" + url.PathEscape(account)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", fmt.Sprint(Digits))
	q.Set("period", fmt.Sprint(Period))
	return "otpauth://totp/" + label + "?" + q.Encode()
}
