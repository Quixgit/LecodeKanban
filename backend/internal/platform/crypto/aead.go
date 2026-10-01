package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
)

// Sealer encrypts small secrets (OAuth tokens) at rest with AES-256-GCM.
// Output layout: version(1) || nonce(12) || ciphertext+tag. The version byte
// allows key rotation later without ambiguity.
type Sealer struct{ aead cipher.AEAD }

const sealVersion byte = 1

var ErrDecrypt = errors.New("crypto: decryption failed")

func NewSealer(key []byte) (*Sealer, error) {
	if len(key) != 32 {
		return nil, errors.New("crypto: AES-256 key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Sealer{aead: aead}, nil
}

// Seal encrypts plaintext; associatedData (e.g. owner ID) binds the ciphertext to its context.
func (s *Sealer) Seal(plaintext, associatedData []byte) ([]byte, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	out := append([]byte{sealVersion}, nonce...)
	return s.aead.Seal(out, nonce, plaintext, associatedData), nil
}

func (s *Sealer) Open(sealed, associatedData []byte) ([]byte, error) {
	ns := s.aead.NonceSize()
	if len(sealed) < 1+ns+s.aead.Overhead() || sealed[0] != sealVersion {
		return nil, ErrDecrypt
	}
	pt, err := s.aead.Open(nil, sealed[1:1+ns], sealed[1+ns:], associatedData)
	if err != nil {
		return nil, ErrDecrypt
	}
	return pt, nil
}
