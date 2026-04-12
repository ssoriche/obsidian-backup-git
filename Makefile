SHELL := /bin/bash

.PHONY: help install dev build test lint format typecheck clean release tag-release

# Default target
help:
	@echo "obsidian-backup-git Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install all dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Build plugin in watch mode"
	@echo ""
	@echo "Build:"
	@echo "  make build            Build plugin for production"
	@echo ""
	@echo "Quality:"
	@echo "  make test             Run tests"
	@echo "  make lint             Run linter"
	@echo "  make format           Format code with Prettier"
	@echo "  make typecheck        Run TypeScript type checking"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            Remove build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  make release VERSION=x.y.z    Create version bump PR"
	@echo "  make tag-release VERSION=x.y.z Tag release after PR merge"

# Install dependencies
install:
	@echo "Installing dependencies..."
	@bun install
	@echo "Dependencies installed!"

# Development
dev:
	@echo "Building plugin in watch mode..."
	@bun run dev

# Build
build:
	@echo "Building plugin..."
	@bun run build

# Quality checks
test:
	@echo "Running tests..."
	@bun run test

lint:
	@echo "Running linter..."
	@bun run lint

format:
	@echo "Formatting code..."
	@bun run format

typecheck:
	@echo "Type checking..."
	@bun run typecheck

# Cleanup
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf plugin/build
	@rm -rf node_modules
	@echo "Clean complete"

# Release management
# Usage: make release VERSION=x.y.z
# This creates a PR with the version bump. After merging, run: make tag-release VERSION=x.y.z
release:
	@if [ -z "$(VERSION)" ]; then \
		echo "Error: VERSION is required. Usage: make release VERSION=x.y.z"; \
		exit 1; \
	fi
	@if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?(\+[A-Za-z0-9.-]+)?$$'; then \
		echo "Error: VERSION '$(VERSION)' is not a valid semver string (e.g., 1.2.3 or 1.2.3-rc.1)"; \
		exit 1; \
	fi
	@echo "Creating release branch for version $(VERSION)..."
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Working directory is not clean. Commit or stash changes first."; \
		exit 1; \
	fi
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "Error: Must be on main branch to release. Currently on $$CURRENT_BRANCH"; \
		echo "Run: git checkout main && git pull"; \
		exit 1; \
	fi
	@git pull --ff-only origin main
	@git checkout -b "release/v$(VERSION)"
	@bun pm version "$(VERSION)" --no-git-tag-version
	@git add package.json
	@git commit -m "chore: bump version to $(VERSION)"
	@git push -u origin "release/v$(VERSION)"
	@printf '## Summary\n\n- Bump version to $(VERSION)\n\nAfter merging, run:\n\n    make tag-release VERSION=$(VERSION)\n' \
		| gh pr create --title "chore: bump version to $(VERSION)" --body-file -
	@echo ""
	@echo "Version bump PR created! After it's merged, run:"
	@echo "  make tag-release VERSION=$(VERSION)"

# Tag a release after the version bump PR is merged
tag-release:
	@if [ -z "$(VERSION)" ]; then \
		echo "Error: VERSION is required. Usage: make tag-release VERSION=x.y.z"; \
		exit 1; \
	fi
	@if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?(\+[A-Za-z0-9.-]+)?$$'; then \
		echo "Error: VERSION '$(VERSION)' is not a valid semver string (e.g., 1.2.3 or 1.2.3-rc.1)"; \
		exit 1; \
	fi
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "Error: Must be on main branch to tag. Currently on $$CURRENT_BRANCH"; \
		echo "Run: git checkout main && git pull"; \
		exit 1; \
	fi
	@git fetch origin main
	@LOCAL=$$(git rev-parse --verify main); \
	REMOTE=$$(git rev-parse --verify origin/main); \
	if [ "$$LOCAL" != "$$REMOTE" ]; then \
		echo "Error: Local main is out of sync with origin/main. Run: git pull"; \
		exit 1; \
	fi
	@PKG_VERSION=$$(jq -r '.version' package.json); \
	if [ "$$PKG_VERSION" != "$(VERSION)" ]; then \
		echo "Error: package.json version ($$PKG_VERSION) does not match VERSION=$(VERSION)."; \
		echo "Did you merge and pull the version bump PR first?"; \
		exit 1; \
	fi
	@MANIFEST_VERSION=$$(jq -r '.version' plugin/manifest.json); \
	if [ "$$MANIFEST_VERSION" != "$(VERSION)" ]; then \
		echo "Error: plugin/manifest.json version ($$MANIFEST_VERSION) does not match VERSION=$(VERSION)."; \
		echo "Did version-bump.mjs run correctly?"; \
		exit 1; \
	fi
	@if git tag -l "v$(VERSION)" | grep -q .; then \
		echo "Error: Local tag v$(VERSION) already exists. Run: git tag -d v$(VERSION)"; \
		exit 1; \
	fi
	@if git ls-remote --tags origin "refs/tags/v$(VERSION)" | grep -q .; then \
		echo "Error: Tag v$(VERSION) already exists on origin."; \
		exit 1; \
	fi
	@echo "Creating and pushing tag v$(VERSION)..."
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@git push origin "v$(VERSION)"
	@echo ""
	@echo "Tag v$(VERSION) pushed successfully!"
	@echo "Monitor the release workflow with: gh run watch"
