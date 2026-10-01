package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// NewToken returns a URL-safe random token with n bytes of entropy.
func NewToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken returns SHA-256(token). Opaque tokens are stored only as hashes,
// so a database leak does not yield usable sessions or reset links.
func HashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}
