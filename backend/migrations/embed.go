// Package migrations embeds the goose SQL migrations into the binaries.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
