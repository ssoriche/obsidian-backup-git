# Development Guide

This guide covers setting up and developing the obsidian-backup-git project locally.

## Overview

**obsidian-backup-git** is an Obsidian plugin that provides automatic backup git versioning without remote sync.

- **Desktop only**: Requires native git installation
- **Multiple commit triggers**: Interval-based, idle-based, and manual commits
- **Smart commit messages**: Follows conventional commits format with file change tracking

## Prerequisites

### Required Tools

1. **Git** - Must be installed on your system
   ```bash
   git --version
   ```

2. **Node.js** - For npm package management
   ```bash
   node --version  # v20+ recommended
   ```

3. **Obsidian** - For testing the plugin
   - Download from [obsidian.md](https://obsidian.md)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd obsidian-backup-git

# Install dependencies
make install
```

### 2. Start Development

```bash
# Build plugin in watch mode
make dev
```

The built plugin will be in `plugin/build/`.

## Development Commands

All commands run from the repository root:

```bash
# Install dependencies
make install

# Development watch mode
make dev

# Production build (includes type checking)
make build

# Run all tests
make test

# Run tests in watch mode
npm run test:watch

# Type checking only
make typecheck

# Linting
make lint
make lint:fix

# Code formatting
make format
make format:check

# Clean build artifacts
make clean
```

**Note**: All npm scripts are configured to run from the `plugin/` subdirectory but should be invoked via `make` from the repository root.

## Testing

### Run All Tests

```bash
make test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run a Single Test File

```bash
cd plugin && npx vitest run src/commit-builder.test.ts
```

### Test Coverage

Tests are written using Vitest and located in `plugin/src/` alongside source files (e.g., `commit-builder.test.ts`).

## Plugin Development

### Building the Plugin

```bash
# Watch mode (rebuilds on changes)
make dev

# Production build
make build
```

The built plugin will be in `plugin/build/`:
- `main.js` - Plugin code
- `manifest.json` - Plugin manifest
- `styles.css` - Plugin styles (empty placeholder)

### Installing Plugin in Obsidian

1. **Build the plugin**:
   ```bash
   make build
   ```

2. **Copy to Obsidian vault**:
   ```bash
   # Create plugin directory
   mkdir -p /path/to/your/vault/.obsidian/plugins/backup-git

   # Copy plugin files
   cp plugin/build/main.js /path/to/your/vault/.obsidian/plugins/backup-git/
   cp plugin/build/manifest.json /path/to/your/vault/.obsidian/plugins/backup-git/
   cp plugin/build/styles.css /path/to/your/vault/.obsidian/plugins/backup-git/
   ```

3. **Enable in Obsidian**:
   - Open Obsidian Settings
   - Go to Community Plugins
   - Enable "Backup Git"

### Plugin Development Workflow

For faster iteration:

1. **Create a symlink** (one-time setup):
   ```bash
   ln -s $(pwd)/plugin/build /path/to/your/vault/.obsidian/plugins/backup-git
   ```

2. **Run plugin in watch mode**:
   ```bash
   make dev
   ```

3. **Reload Obsidian** when changes are made:
   - Disable and re-enable the plugin in settings, OR
   - Use the "Reload app without saving" command (Ctrl/Cmd+R in developer mode)

### Plugin Scripts

```bash
cd plugin

# Development
npm run dev              # Watch mode (via esbuild)

# Build
npm run build            # Production build with type checking

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting errors
npm run format           # Format with Prettier
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
```

## Project Structure

```
obsidian-backup-git/
├── plugin/                     # Plugin source
│   ├── src/
│   │   ├── main.ts            # Plugin entry point (UI layer)
│   │   ├── git-engine.ts      # Git operations wrapper
│   │   ├── commit-builder.ts  # Commit message builder
│   │   └── commit-builder.test.ts
│   ├── build/                 # Built plugin files
│   ├── manifest.json          # Plugin manifest
│   ├── esbuild.config.mjs     # Build configuration
│   ├── eslint.config.mjs      # ESLint configuration
│   ├── vitest.config.ts       # Test configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── package.json
├── Makefile                   # Development commands
├── package.json               # Root package.json (proxies to plugin/)
├── DEVELOPMENT.md             # This file
├── CLAUDE.md                  # Claude Code guidance
└── README.md                  # User-facing documentation
```

## Architecture

### Three-Layer Design

The plugin follows a clean separation of concerns:

1. **UI Layer** (`main.ts`): The `LocalGitPlugin` class handles:
   - Obsidian plugin lifecycle (onload/onunload)
   - Settings persistence and UI
   - Timer management (interval-based and idle-based commits)
   - File change event listeners with debouncing
   - User notifications and status bar updates

2. **Git Operations** (`git-engine.ts`): The `GitEngine` class wraps simple-git:
   - Git repository initialization and validation
   - Status checking and diff stats
   - Stage and commit operations
   - Error handling and state management
   - Uses callbacks to notify the UI layer of state changes

3. **Commit Logic** (`commit-builder.ts`): Pure functions for:
   - Building conventional commit messages
   - Formatting file names with `[DELETES]` markers for net deletions
   - Truncating file lists with "and N more" suffix

### Key Implementation Details

- **Event Debouncing**: File changes are queued and debounced (2 second delay) to avoid excessive commits during rapid edits
- **Commit Prevention**: The `commitInProgress` flag prevents concurrent commits
- **Status Callbacks**: GitEngine uses callbacks (`onStatusChange`, `onError`) to communicate with the UI layer without tight coupling
- **Timer Management**: Separate timers for interval-based commits (default 5 minutes) and idle detection (checks every 30 seconds)

## Common Tasks

### Creating a New Vault for Testing

```bash
# Create test vault directory
mkdir -p ~/obsidian-test-vault

# Open in Obsidian
# File → Open folder as vault → Select ~/obsidian-test-vault
```

### Debugging

#### Plugin Debugging

1. Enable developer mode in Obsidian:
   - Settings → About → Advanced → Debug mode

2. Open Developer Tools:
   - Ctrl/Cmd + Shift + I

3. View console logs and errors in the Console tab

4. Enable debug logging in plugin settings:
   - Settings → Backup Git → Advanced → Debug logging

#### Git Debugging

The plugin uses `simple-git` to interact with git. To debug git issues:

```bash
# Check git status in your vault
cd /path/to/your/vault
git status

# View recent commits
git log --oneline -10

# Check git config
git config --list
```

### Testing Commit Triggers

1. **Manual Commit**:
   - Click ribbon icon (if enabled)
   - Or use command palette: "Commit changes"

2. **Interval-based Commit**:
   - Enable in settings
   - Set interval (default: 5 minutes)
   - Make changes and wait for interval

3. **Idle-based Commit**:
   - Enable in settings
   - Set idle time (default: 10 minutes)
   - Make changes, then stop editing and wait

### Cleanup

```bash
# Remove build artifacts
make clean

# Remove all dependencies
rm -rf node_modules plugin/node_modules
```

## Troubleshooting

### Git Not Found Error

If you see "Git is not installed" error:

```bash
# Verify git is installed and in PATH
git --version

# On macOS, install via Homebrew
brew install git

# On Windows, download from git-scm.com
```

### Plugin Not Loading in Obsidian

1. Check build output: `ls -la plugin/build/`
2. Verify files are in vault: `ls -la /path/to/vault/.obsidian/plugins/backup-git/`
3. Check Obsidian console for errors (Ctrl/Cmd + Shift + I)
4. Try disabling and re-enabling the plugin
5. Check that manifest.json has correct structure

### Commits Not Triggering

1. Check plugin settings are enabled:
   - Settings → Backup Git
   - Enable interval or idle commits

2. Enable debug logging to see timer activity:
   - Settings → Backup Git → Advanced → Debug logging
   - Check console for "[Backup Git]" messages

3. Verify there are uncommitted changes:
   ```bash
   cd /path/to/your/vault
   git status
   ```

### TypeScript Errors

If you see type errors:

```bash
# Run type checking to see all errors
make typecheck

# Ensure dependencies are installed
make install

# Check TypeScript version
cd plugin && npx tsc --version
```

## Code Quality

### Linting

The project uses ESLint with strict TypeScript rules:

```bash
# Lint all code
make lint

# Auto-fix issues
make lint:fix
```

### Formatting

Prettier is used for code formatting:

```bash
# Format all code
make format

# Check formatting without changing files
make format:check
```

### Type Checking

Strict TypeScript checking is enabled:

```bash
make typecheck
```

## Release Management

### Creating a Release

```bash
# Create version bump PR
make release VERSION=x.y.z

# After PR is merged, tag the release
make tag-release VERSION=x.y.z
```

The release process:
1. Creates a release branch
2. Updates `plugin/manifest.json` with new version
3. Creates a PR for review
4. After merge, tags the release (triggers GitHub Actions)

## Configuration

### Plugin Settings

Settings are stored in Obsidian's data directory via the plugin API:

- **Auto-commit Settings**:
  - Enable/disable interval-based commits
  - Interval duration (minutes)
  - Enable/disable idle-based commits
  - Idle timeout (minutes)

- **Commit Messages**:
  - Max files to show in commit message (rest shown as "and N more")

- **User Interface**:
  - Show/hide ribbon icon (requires plugin reload)
  - Show/hide status bar

- **Advanced**:
  - Additional .gitignore patterns (not yet implemented)
  - Debug logging toggle

### Build Configuration

- **esbuild** (`plugin/esbuild.config.mjs`):
  - Bundles TypeScript to single JavaScript file
  - Excludes Obsidian API and built-in modules
  - Inline sourcemaps in dev, none in production

- **TypeScript** (`plugin/tsconfig.json`):
  - Strict mode enabled
  - ES2018 target
  - Module bundler resolution

- **ESLint** (`plugin/eslint.config.mjs`):
  - TypeScript strict and stylistic rules
  - Consistent type imports enforced
  - Unused variables prefixed with `_` allowed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `make lint && make test && make typecheck`
5. Format code: `make format`
6. Commit with conventional commits format (e.g., `feat:`, `fix:`, `chore:`)
7. Push and create a PR

## Resources

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [simple-git Documentation](https://github.com/steveukx/git-js)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [ESBuild Documentation](https://esbuild.github.io/)
- [Vitest Documentation](https://vitest.dev/)
