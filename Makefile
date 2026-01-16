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
	@npm install
	@echo "Dependencies installed!"

# Development
dev:
	@echo "Building plugin in watch mode..."
	@npm run dev

# Build
build:
	@echo "Building plugin..."
	@npm run build

# Quality checks
test:
	@echo "Running tests..."
	@npm run test

lint:
	@echo "Running linter..."
	@npm run lint

format:
	@echo "Formatting code..."
	@npm run format

typecheck:
	@echo "Type checking..."
	@npm run typecheck

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
	@echo "Creating release branch for version $(VERSION)..."
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Working directory is not clean. Commit or stash changes first."; \
		exit 1; \
	fi
	@git checkout -b "release/v$(VERSION)"
	@echo "Updating plugin manifest to version $(VERSION)..."
	@sed -i.bak 's/"version": "[^"]*"/"version": "$(VERSION)"/' plugin/manifest.json && rm plugin/manifest.json.bak
	@git add plugin/manifest.json
	@git commit -m "chore: bump version to $(VERSION)"
	@git push -u origin "release/v$(VERSION)"
	@echo "Creating pull request..."
	@gh pr create --title "chore: bump version to $(VERSION)" --body "## Summary\n\n- Update plugin manifest version to $(VERSION)\n- Prepare for release v$(VERSION)\n\nAfter merging, create the release tag with: make tag-release VERSION=$(VERSION)"
	@echo ""
	@echo "Version bump PR created! After it's merged, run:"
	@echo "  make tag-release VERSION=$(VERSION)"

# Tag a release after the version bump PR is merged
tag-release:
	@if [ -z "$(VERSION)" ]; then \
		echo "Error: VERSION is required. Usage: make tag-release VERSION=x.y.z"; \
		exit 1; \
	fi
	@CURRENT_BRANCH=$$(git branch --show-current); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "Error: Must be on main branch to tag. Currently on $$CURRENT_BRANCH"; \
		echo "Run: git checkout main && git pull"; \
		exit 1; \
	fi
	@echo "Creating and pushing tag v$(VERSION)..."
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@git push origin "v$(VERSION)"
	@echo ""
	@echo "Tag v$(VERSION) pushed successfully!"
	@echo "Monitor the release workflow with: gh run watch"
