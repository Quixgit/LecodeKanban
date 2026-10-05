package main

import (
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

// version is the release, stamped at build time (-ldflags "-X main.version=1.2.3"); "dev" for a local build.
var version = "dev"

// buildInfo tells which build is running and on what: the release, the commit and time the toolchain recorded,
// the Go version and the database server's version.
func buildInfo(pool *pgxpool.Pool) http.HandlerFunc {
	commit, builtAt := "", ""
	if bi, ok := debug.ReadBuildInfo(); ok {
		for _, s := range bi.Settings {
			switch s.Key {
			case "vcs.revision":
				commit = s.Value
				if len(commit) > 8 {
					commit = commit[:8]
				}
			case "vcs.time":
				builtAt = s.Value
			}
		}
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var server string
		if err := pool.QueryRow(r.Context(), `SHOW server_version`).Scan(&server); err != nil {
			server = "unknown"
		}
		// "16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)" → "16.14"
		if f := strings.Fields(server); len(f) > 0 {
			server = f[0]
		}
		httpx.WriteJSON(w, http.StatusOK, api.BuildInfo{
			Version: version, Commit: commit, BuiltAt: builtAt,
			GoVersion: strings.TrimPrefix(runtime.Version(), "go"), Database: "PostgreSQL " + server,
		})
	}
}
