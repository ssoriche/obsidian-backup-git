# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin for automatic backup git versioning without remote sync. Desktop-only, requires native git.

## Essential Commands

**From repository root** (use `make` targets):
```bash
make dev              # Watch mode
make build            # Production build with type checking
make test             # Run all tests
make lint             # Run linter
make format           # Format code
```

**Testing**:
- Tests use Vitest, located in `plugin/src/` alongside source files
- Run single test: `cd plugin && npx vitest run src/commit-builder.test.ts`
- Watch mode: `npm run test:watch`

## Architecture

Three-layer design with clear separation:

1. **`plugin/src/main.ts`** (UI Layer):
   - Plugin lifecycle, settings, timers
   - File change listeners with 2-second debounce in `queueFileChange()`
   - `commitInProgress` flag prevents concurrent commits
   - Status bar and ribbon icon management

2. **`plugin/src/git-engine.ts`** (Git Operations):
   - Wraps `simple-git` library
   - Callbacks (`onStatusChange`, `onError`) for loose coupling with UI
   - `getDiffStats()` returns file changes with additions/deletions for commit messages

3. **`plugin/src/commit-builder.ts`** (Pure Functions):
   - Builds conventional commit messages from file stats
   - Adds `[DELETES]` marker for files with net deletions
   - Truncates file lists: "file1, file2 and 3 more"

## Key Implementation Details

- **Event Debouncing**: Changes queued in `changeQueue` Set, cleared after 2s of inactivity
- **Timer Management**: Separate intervals for auto-commits (default 5min) and idle checks (every 30s)
- **Vault Access**: `this.app.vault.adapter.basePath` gets filesystem path
- **Build**: esbuild bundles to `plugin/build/main.js`, copies `manifest.json`, creates empty `styles.css`

## Testing in Obsidian

1. `make build`
2. Symlink: `ln -s $(pwd)/plugin/build /path/to/vault/.obsidian/plugins/backup-git`
3. Enable in Settings → Community Plugins
4. Reload plugin after changes: disable/enable or Ctrl/Cmd+R

## Common Patterns

- All source in `plugin/src/`, build output in `plugin/build/`
- npm scripts run from `plugin/` but use `make` from root
- Strict TypeScript with stylistic rules (see `plugin/eslint.config.mjs`)
- Unused vars prefixed with `_` are allowed
