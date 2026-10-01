// Package crypto provides password hashing (argon2id), authenticated encryption
// (AES-256-GCM) and opaque token helpers.
package crypto

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2Params follow OWASP's argon2id recommendation (m=64MiB, t=3, p=2).
type Argon2Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLen     uint32
	KeyLen      uint32
}

var DefaultArgon2 = Argon2Params{Memory: 64 * 1024, Iterations: 3, Parallelism: 2, SaltLen: 16, KeyLen: 32}

var ErrMismatchedHash = errors.New("crypto: password does not match")

// HashPassword returns a PHC-formatted argon2id hash.
func HashPassword(password string, p Argon2Params) (string, error) {
	salt := make([]byte, p.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLen)
	b64 := base64.RawStdEncoding
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, p.Memory, p.Iterations, p.Parallelism, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword checks password against a PHC hash in constant time.
// needsRehash reports whether the stored parameters are weaker than want.
func VerifyPassword(password, encoded string, want Argon2Params) (needsRehash bool, err error) {
	p, salt, key, err := decodeHash(encoded)
	if err != nil {
		return false, err
	}
	other := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, uint32(len(key))) //nolint:gosec // G115: key length ≤ hash string length
	if subtle.ConstantTimeCompare(key, other) != 1 {
		return false, ErrMismatchedHash
	}
	return p.Memory < want.Memory || p.Iterations < want.Iterations || p.Parallelism < want.Parallelism, nil
}

func decodeHash(encoded string) (Argon2Params, []byte, []byte, error) {
	var p Argon2Params
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return p, nil, nil, errors.New("crypto: invalid hash format")
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return p, nil, nil, errors.New("crypto: unsupported argon2 version")
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Iterations, &p.Parallelism); err != nil {
		return p, nil, nil, errors.New("crypto: invalid argon2 parameters")
	}
	b64 := base64.RawStdEncoding
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return p, nil, nil, errors.New("crypto: invalid salt")
	}
	key, err := b64.DecodeString(parts[5])
	if err != nil {
		return p, nil, nil, errors.New("crypto: invalid key")
	}
	return p, salt, key, nil
}
