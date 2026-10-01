// Package testdb starts a throwaway PostgreSQL 16 (testcontainers) with all
// migrations applied, shared by the tests of one package.
//
// Set LK_TEST_DATABASE_URL to reuse an existing empty database instead (CI services).
package testdb

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/reliabilix/lecodekanban/backend/migrations"
)

// DB is a migrated test database.
type DB struct {
	Pool      *pgxpool.Pool
	URL       string
	terminate func()
}

// Start launches the database; call from TestMain and Close when done.
func Start() (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	url := os.Getenv("LK_TEST_DATABASE_URL")
	terminate := func() {}
	if url == "" {
		c, err := tcpg.Run(ctx, "postgres:16-alpine",
			tcpg.WithDatabase("lk_test"), tcpg.WithUsername("lk"), tcpg.WithPassword("lk"),
			testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(time.Minute)),
		)
		if err != nil {
			return nil, fmt.Errorf("testdb: start container: %w", err)
		}
		terminate = func() { _ = testcontainers.TerminateContainer(c) }
		if url, err = c.ConnectionString(ctx, "sslmode=disable"); err != nil {
			terminate()
			return nil, err
		}
	}
	if err := migrate(ctx, url); err != nil {
		terminate()
		return nil, err
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		terminate()
		return nil, err
	}
	return &DB{Pool: pool, URL: url, terminate: terminate}, nil
}

func migrate(ctx context.Context, url string) error {
	db, err := sql.Open("pgx", url)
	if err != nil {
		return err
	}
	defer func() { _ = db.Close() }()
	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, db, ".")
}

func (d *DB) Close() {
	d.Pool.Close()
	d.terminate()
}

// Reset truncates every application table so each test starts clean.
func (d *DB) Reset(t testing.TB) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(), `TRUNCATE users, workspaces, jobs RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("testdb reset: %v", err)
	}
}

// Main wraps TestMain: starts the DB, runs the tests and tears down. It fails fast
// when neither Docker nor LK_TEST_DATABASE_URL is available.
func Main(m *testing.M, out **DB) {
	db, err := Start()
	if err != nil {
		fmt.Fprintln(os.Stderr, "testdb unavailable:", err)
		os.Exit(1)
	}
	*out = db
	code := m.Run()
	db.Close()
	os.Exit(code)
}
