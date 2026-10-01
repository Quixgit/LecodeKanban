// Command migrate applies the embedded goose migrations.
//
//	migrate up | down | status | redo | version | reset
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/reliabilix/lecodekanban/backend/migrations"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "migrate:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: migrate up|down|status|redo|version|reset")
	}
	url := os.Getenv("LK_DATABASE_URL")
	if url == "" {
		return errors.New("LK_DATABASE_URL is required")
	}
	if args[0] == "reset" && os.Getenv("LK_ENV") == "production" {
		return errors.New("refusing to reset a production database")
	}
	db, err := sql.Open("pgx", url)
	if err != nil {
		return err
	}
	defer func() { _ = db.Close() }()

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.RunContext(context.Background(), args[0], db, ".", args[1:]...)
}
