# AGENTS.md
# Context specification for AI agents continuing development of this project

## Project Overview

This is an Obsidian plugin that provides automatic backup git versioning without remote sync. It's designed for users who want version control for their notes without cloud synchronization.

### Key Features
- Automatic backup git versioning of vault changes
- Multiple commit triggers: interval-based, idle-based, and manual
- Smart commit messages following conventional commits format
- Desktop-only (requires native git installation)
- No remote sync - purely local version control

## Architecture

### Components
1. **Obsidian Plugin** (plugin/)
   - UI Layer: Plugin lifecycle, settings, timers
   - Git Engine: Wraps simple-git for git operations
   - Commit Builder: Pure functions for commit message generation

### Three-Layer Design

**UI Layer** (`plugin/src/main.ts`):
- `LocalGitPlugin` class handles Obsidian plugin API integration
- Settings persistence and configuration UI
- Timer management for interval-based (default 5min) and idle-based commits
- File change event listeners with 2-second debouncing
- Status bar and optional ribbon icon
- User notifications via Obsidian Notice API

**Git Operations** (`plugin/src/git-engine.ts`):
- `GitEngine` class wraps simple-git library
- Repository initialization and validation
- Git status checking and diff stats collection
- Stage and commit operations
- Uses callback pattern for UI updates (`onStatusChange`, `onError`)
- Handles git installation verification

**Commit Logic** (`plugin/src/commit-builder.ts`):
- Pure functions for commit message generation
- Follows conventional commits format (`chore: update ...`)
- Marks files with net deletions using `[DELETES]` suffix
- Truncates file lists: "file1, file2 and 3 more"

## Code Organization

```
obsidian-backup-git/
├── plugin/                     # Plugin source
│   ├── src/
│   │   ├── main.ts            # Plugin entry point (UI layer)
│   │   ├── git-engine.ts      # Git operations wrapper
│   │   ├── commit-builder.ts  # Commit message builder
│   │   └── commit-builder.test.ts  # Unit tests
│   ├── build/                 # Built plugin files (gitignored)
│   ├── manifest.json          # Plugin manifest
│   ├── esbuild.config.mjs     # Build configuration
│   ├── eslint.config.mjs      # ESLint strict rules
│   ├── vitest.config.ts       # Test configuration
│   └── tsconfig.json          # TypeScript strict config
├── Makefile                   # Development commands
├── package.json               # Root package.json (proxies to plugin/)
├── DEVELOPMENT.md             # Comprehensive development guide
├── CLAUDE.md                  # Claude Code guidance
├── AGENTS.md                  # This file
└── README.md                  # User-facing documentation
```

## Essential Commands

### Development Setup
```bash
# Install dependencies
make install

# Start watch mode
make dev

# Build for production (includes type checking)
make build
```

### Development Workflow
```bash
# Watch mode for rapid iteration
make dev

# Run tests
make test
npm run test:watch

# Run specific test
cd plugin && npx vitest run src/commit-builder.test.ts

# Quality checks
make lint
make format
make typecheck
```

### Build Commands
```bash
# Production build with type checking
make build

# Clean build artifacts
make clean
```

### Quality Checks
```bash
# Run tests
make test

# Run linters
make lint
make lint:fix

# Format code
make format
make format:check

# Type checking
make typecheck
```

## Technology Stack

### Plugin
- **Language**: TypeScript (strict mode)
- **Framework**: Obsidian Plugin API
- **Git Library**: simple-git
- **Build Tool**: esbuild
- **Testing**: Vitest
- **Linting**: ESLint with typescript-eslint strict rules

## Code Patterns and Conventions

### Plugin Code Patterns
- **Event Debouncing**: File changes queued in Set, cleared after 2s inactivity via `queueFileChange()`
- **Commit Prevention**: `commitInProgress` boolean flag prevents concurrent commits
- **Timer Management**: Separate intervals for auto-commits and idle detection checks
- **Callback Pattern**: GitEngine uses callbacks for loose coupling with UI layer
- **Vault Access**: `this.app.vault.adapter.basePath` gets filesystem path
- **Settings Persistence**: Uses Obsidian's `loadData()`/`saveData()` API

### Build Process
1. esbuild bundles `plugin/src/main.ts` → `plugin/build/main.js`
2. Copies `plugin/manifest.json` → `plugin/build/manifest.json`
3. Creates empty `plugin/build/styles.css`
4. Watch mode uses inline sourcemaps, production excludes sourcemaps

### TypeScript Configuration
- **Target**: ES2018
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Enabled with all strict checks
- **Unused Detection**: `noUnusedLocals`, `noUnusedParameters`
- **Imports**: `verbatimModuleSyntax` for explicit type imports

### ESLint Rules
- TypeScript strict and stylistic rules
- `@typescript-eslint/consistent-type-imports`: Enforced
- `@typescript-eslint/no-import-type-side-effects`: Enforced
- Unused vars prefixed with `_` are allowed

## Testing Approach

- Unit tests for pure functions (commit-builder.ts)
- Tests colocated with source files (`.test.ts` suffix)
- Vitest for test runner with globals enabled
- Future: Integration tests for git operations
- Future: E2E tests for plugin in Obsidian environment

## Important Gotchas

1. **Git Requirement**: Plugin requires native git installation, checked on load
2. **Desktop Only**: Won't work on mobile (git not available)
3. **Vault Path Access**: Must cast adapter to access `basePath` property
4. **Timer Lifecycle**: Timers must be properly cleaned up in `onunload()`
5. **Ribbon Icon**: Dynamic add/remove not supported, requires plugin reload
6. **Event Debouncing**: Critical for avoiding commit spam during rapid edits
7. **Commit Conflicts**: Plugin can't handle merge conflicts (local-only)
8. **Repository Init**: Auto-creates .gitignore and initial commit if no repo exists
9. **Build Output**: `plugin/build/` must be copied/symlinked to vault's plugin directory

## Project-Specific Context

### Why Local-Only Git
The user wanted automatic version control without the complexity or risk of remote sync:
- No cloud storage concerns
- No authentication/credential management
- Simpler mental model (just local history)
- Faster commits (no network operations)

### Why simple-git
Provides a clean Promise-based API for git operations:
- Cross-platform (Windows, macOS, Linux)
- Well-maintained and widely used
- Handles git binary invocation and output parsing
- Better than spawning git processes manually

### Why Conventional Commits
Provides structured, parseable commit messages:
- Standardized format for automated tools
- Clear categorization of changes (chore, feat, fix)
- Aligns with common development practices

### Development Environment
- Uses npm for package management
- Make targets for consistent command interface
- No devbox/Docker requirements (simpler than obsidian-sync-pg)
- Local git installation is the only external dependency

## Issue Tracking with Beads

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

### Quick Reference
```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status=in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

