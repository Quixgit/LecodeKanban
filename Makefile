# LecodeKanban — developer entry points.
# Backend targets (migrate, seed, gen, worker) are added with the backend in phase 2.

SHELL := /bin/bash
FE    := frontend
-include .env
export

LK_WEB_PORT ?= 47100
LK_PUBLIC_HOST ?= 23.19.228.158

.PHONY: help install dev build preview test test-watch lint typecheck fmt check clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend dependencies (npm ci)
	cd $(FE) && npm ci

dev: ## Run the Vite dev server on http://$(LK_PUBLIC_HOST):$(LK_WEB_PORT)
	cd $(FE) && npm run dev

build: ## Production build of the frontend
	cd $(FE) && npm run build

preview: build ## Serve the production build on the web port
	cd $(FE) && npm run preview

test: ## Run all tests
	cd $(FE) && npm test

test-watch: ## Run frontend tests in watch mode
	cd $(FE) && npm run test:watch

typecheck: ## TypeScript strict check
	cd $(FE) && npm run typecheck

lint: ## ESLint + Prettier check
	cd $(FE) && npm run lint && npm run format:check

fmt: ## Format sources
	cd $(FE) && npm run format

check: typecheck lint test ## Everything CI runs

clean: ## Remove build artifacts
	rm -rf $(FE)/dist $(FE)/coverage
