# LecodeKanban — developer entry points. Run `make help`.
#
# Config comes from .env (copy .env.example). Ports follow docs/adr/0004.

SHELL   := /bin/bash
FE      := frontend
BE      := backend
COMPOSE := docker compose -f docker-compose.dev.yml --env-file .env
GOLANGCI ?= golangci-lint

# .env is shell syntax (quotes, spaces): source it per recipe instead of `include`-ing it into make.
ENV := set -a; [ -f .env ] && . ./.env; set +a;

.PHONY: help install deps-up deps-down dev dev-api dev-web migrate-up migrate-down migrate-status \
        migrate-create seed adduser gen gen-check build test test-backend test-frontend cover lint lint-backend \
        lint-frontend fmt check clean deploy deploy-ps deploy-logs deploy-down e2e e2e-up e2e-down

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install Go modules and npm packages
	cd $(BE) && go mod download
	cd $(FE) && npm ci

# ---------------------------------------------------------------- production stack (docs/adr/0009)

deploy: ## Build images and (re)start the always-on stack (docker-compose.yml)
	docker compose up -d --build --wait

deploy-ps: ## Status of the production containers
	docker compose ps

deploy-logs: ## Follow API, worker and web logs
	docker compose logs -f --tail 100 api worker web

E2E := docker compose -p lke2e --env-file .env.e2e

e2e-up: ## Isolated test stack on localhost:48100 (own database) with demo data
	./scripts/e2e-env.sh
	$(E2E) up -d --build --wait
	set -a; . ./.env.e2e; set +a; cd $(BE) && LK_ENV=development \
	  LK_DATABASE_URL="postgres://lecodekanban:$$LK_POSTGRES_PASSWORD@127.0.0.1:$$LK_POSTGRES_PORT/lecodekanban?sslmode=disable" \
	  go run ./cmd/seed

e2e: e2e-up ## Playwright end-to-end tests against the isolated stack (set PW_CHROMIUM to reuse a browser)
	cd $(FE) && E2E_PASSWORD="$${LK_SEED_PASSWORD:-Demo-Kanban-2026}" npx playwright test

e2e-down: ## Remove the isolated test stack and its data
	$(E2E) down -v

deploy-down: ## Stop the production stack (data volume is kept)
	docker compose down

# ---------------------------------------------------------------- local dev

deps-up: ## Start Postgres + Mailpit (docker compose)
	$(COMPOSE) up -d --wait

deps-down: ## Stop dev dependencies (data volume is kept)
	$(COMPOSE) down

dev: deps-up migrate-up ## Run API (hot reload) + web (LK_PUBLIC_URL, default port 47100)
	@$(MAKE) -j2 --no-print-directory dev-api dev-web

dev-api: ## API with hot reload (air)
	$(ENV) cd $(BE) && go tool air -c .air.toml

dev-web: ## Vite dev server
	$(ENV) cd $(FE) && npm run dev

# ---------------------------------------------------------------- database

migrate-up: ## Apply all migrations
	$(ENV) cd $(BE) && go run ./cmd/migrate up

migrate-down: ## Roll back the last migration
	$(ENV) cd $(BE) && go run ./cmd/migrate down

migrate-status: ## Show migration status
	$(ENV) cd $(BE) && go run ./cmd/migrate status

seed: ## Load demo data (people, projects, tasks, history); add RESET=1 to recreate
	$(ENV) cd $(BE) && go run ./cmd/seed $(if $(RESET),-reset,)

adduser: ## Create accounts: make adduser WS="Workspace name" EMAILS="a@x.com b@x.com" [ROLE=member] [LOCALE=en]
	$(ENV) cd $(BE) && go run ./cmd/adduser -workspace "$(WS)" -role $(or $(ROLE),member) -locale $(or $(LOCALE),en) $(EMAILS)

migrate-create: ## Create a migration: make migrate-create name=add_boards
	@test -n "$(name)" || (echo "usage: make migrate-create name=<snake_case>" && exit 1)
	cd $(BE) && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0 -dir migrations create $(name) sql

# ---------------------------------------------------------------- codegen

gen: ## Regenerate sqlc, Go DTOs, TS client and docs/API.md from their sources
	cd $(BE) && go tool sqlc generate
	cd $(BE)/internal/api && go tool oapi-codegen -config oapi-codegen.yaml ../../../api/openapi.yaml
	cd $(FE) && npm run gen:api && npx prettier --write src/shared/api/schema.gen.ts >/dev/null
	cd $(FE) && node scripts/gen-api-docs.mjs

gen-check: gen ## Fail if generated code is out of date (CI)
	git diff --exit-code -- $(BE)/internal/api $(BE)/internal/modules/*/repository/store $(FE)/src/shared/api/schema.gen.ts docs/API.md

# ---------------------------------------------------------------- build & quality

build: ## Build API/worker/migrate binaries and the web bundle
	cd $(BE) && CGO_ENABLED=0 go build -trimpath -o bin/ ./cmd/...
	cd $(FE) && npm run build

test: test-backend test-frontend ## Run all tests

test-backend: ## Go tests (integration tests start Postgres via testcontainers)
	cd $(BE) && go test -race ./...

test-frontend: ## Vitest unit/component tests
	cd $(FE) && npm test

cover: ## Go coverage report for services and platform
	cd $(BE) && go test -coverprofile=coverage.out ./... >/dev/null && go tool cover -func=coverage.out | tail -1

lint: lint-backend lint-frontend ## All linters

lint-backend: ## go vet + golangci-lint
	cd $(BE) && go vet ./... && $(GOLANGCI) run ./...

lint-frontend: ## tsc + ESLint + Prettier
	cd $(FE) && npm run typecheck && npm run lint && npm run format:check

fmt: ## Format Go and TS sources
	cd $(BE) && gofmt -w .
	cd $(FE) && npm run format

check: lint test ## Everything CI runs

clean: ## Remove build artefacts
	rm -rf $(BE)/bin $(BE)/tmp $(BE)/coverage.out $(FE)/dist $(FE)/coverage
