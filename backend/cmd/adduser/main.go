// Command adduser creates accounts and puts them into a workspace. It prints a one-time
// password for each new account; hand it over privately and ask the person to change it
// (Profile → Security). Existing accounts are only added to the workspace.
//
//	go run ./cmd/adduser -workspace "Reliabilix Studio" [-role member] [-locale en] \
//	    a.sarkisian@example.com "Anna Sarkisian <anna@example.com>" ...
package main

import (
	"context"
	"crypto/rand"
	"errors"
	"flag"
	"fmt"
	"math/big"
	"net/mail"
	"os"
	"strings"
	"unicode"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	wsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

func main() {
	workspace := flag.String("workspace", "", "workspace name or slug to add the people to")
	role := flag.String("role", "member", "role in the workspace: admin, member or viewer")
	locale := flag.String("locale", "en", "interface language of the new accounts: en or uk")
	flag.Parse()
	if err := run(*workspace, *role, *locale, flag.Args()); err != nil {
		fmt.Fprintln(os.Stderr, "adduser:", err)
		os.Exit(1)
	}
}

// nameFromEmail turns "a.sarkisian@x" into "A Sarkisian".
func nameFromEmail(addr string) string {
	local, _, _ := strings.Cut(addr, "@")
	parts := strings.FieldsFunc(local, func(r rune) bool { return r == '.' || r == '_' || r == '-' })
	for i, p := range parts {
		r := []rune(p)
		r[0] = unicode.ToUpper(r[0])
		parts[i] = string(r)
	}
	return strings.Join(parts, " ")
}

// parse reads "email" or "Full Name <email>".
func parse(arg string) (email, name string, err error) {
	a, err := mail.ParseAddress(arg)
	if err != nil {
		return "", "", fmt.Errorf("%q is not an email address", arg)
	}
	email = strings.ToLower(a.Address)
	if name = strings.TrimSpace(a.Name); name == "" {
		name = nameFromEmail(email)
	}
	return email, name, nil
}

const (
	lower   = "abcdefghijkmnopqrstuvwxyz"
	upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	digits  = "23456789"
	symbols = "-_.!"
)

// password is 18 random characters with all four classes, without look-alike characters.
func password() (string, error) {
	all := lower + upper + digits + symbols
	pick := func(set string) (byte, error) {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(set))))
		if err != nil {
			return 0, err
		}
		return set[n.Int64()], nil
	}
	out := make([]byte, 0, 18)
	for _, set := range []string{lower, upper, digits, symbols} {
		c, err := pick(set)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}
	for len(out) < 18 {
		c, err := pick(all)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}
	// Shuffle so the classes are not always in the same places.
	for i := len(out) - 1; i > 0; i-- {
		j, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", err
		}
		out[i], out[j.Int64()] = out[j.Int64()], out[i]
	}
	return string(out), nil
}

func run(workspace, role, locale string, args []string) error {
	if workspace == "" || len(args) == 0 {
		return errors.New("usage: adduser -workspace <name or slug> [-role member] [-locale en] email...")
	}
	r := wsdomain.Role(role)
	if r != wsdomain.RoleAdmin && r != wsdomain.RoleMember && r != wsdomain.RoleViewer {
		return fmt.Errorf("role must be admin, member or viewer, not %q", role)
	}
	loc := usersdomain.Locale(locale)
	if !loc.Valid() {
		return fmt.Errorf("locale must be en or uk, not %q", locale)
	}
	url := os.Getenv("LK_DATABASE_URL")
	if url == "" {
		return errors.New("LK_DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url, 2)
	if err != nil {
		return err
	}
	defer pool.Close()

	var ids []string
	rows, err := pool.Query(ctx, `SELECT id::text FROM workspaces WHERE slug = $1 OR lower(name) = lower($1)`, workspace)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if len(ids) != 1 {
		return fmt.Errorf("workspace %q matches %d workspaces; use the exact name or slug", workspace, len(ids))
	}

	users := userssvc.New(usersrepo.New(pool), eventbus.New())
	members := wsrepo.New(pool)
	wsUUID, err := uuid.Parse(ids[0])
	if err != nil {
		return err
	}

	fmt.Printf("%-40s %-24s %s\n", "EMAIL", "NAME", "PASSWORD")
	for _, arg := range args {
		email, name, err := parse(arg)
		if err != nil {
			return err
		}
		existing, err := users.CredentialsByEmail(ctx, email)
		pass := "(existing account, unchanged)"
		userID := existing.User.ID
		switch {
		case err == nil:
		case apperr.IsCode(err, usersdomain.ErrNotFound):
			plain, perr := password()
			if perr != nil {
				return perr
			}
			hash, herr := crypto.HashPassword(plain, crypto.DefaultArgon2)
			if herr != nil {
				return herr
			}
			u, cerr := users.Create(ctx, usersdomain.NewUser{Email: email, Name: name, PasswordHash: &hash, Locale: loc, Verified: true})
			if cerr != nil {
				return fmt.Errorf("%s: %w", email, cerr)
			}
			userID, pass = u.ID, plain
		default:
			return fmt.Errorf("%s: %w", email, err)
		}
		if err := members.AddMember(ctx, wsUUID, userID, r); err != nil {
			// Already a member: keep their role.
			fmt.Fprintf(os.Stderr, "note: %s is already in the workspace\n", email)
		}
		fmt.Printf("%-40s %-24s %s\n", email, name, pass)
	}
	return nil
}
