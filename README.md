# Obsidian Backup Git Plugin

Automatic backup git versioning for Obsidian without remote sync.

## Features

- **Backup Git Versioning**: Automatically commit changes to a backup git repository
- **Multiple Commit Triggers**:
  - Interval-based commits (e.g., every 5 minutes)
  - Idle-based commits (after X minutes of no edits)
  - Manual commits via ribbon icon or command palette
- **Smart Commit Messages**:
  - Follows conventional commits format
  - Includes changed file names
  - Marks files with net deletions with `[DELETES]` indicator
- **Configurable UI**: Optional ribbon icon, status bar item
- **Desktop Only**: Requires native git installation

## Installation

### Prerequisites

- Git must be installed on your system
- Obsidian desktop app (not mobile)

### Install Plugin

1. Clone this repository into your vault's `.obsidian/plugins/` directory
2. Run `npm install` in the plugin directory
3. Run `npm run build`
4. Enable the plugin in Obsidian settings

## Usage

### Initial Setup

The plugin will automatically initialize a git repository in your vault if one doesn't exist.

### Settings

Configure the plugin behavior in Settings → Backup Git:

- **Auto-commit Settings**: Enable/disable interval and idle-based commits
- **Commit Messages**: Configure how many files to show in commit messages
- **User Interface**: Toggle ribbon icon and status bar visibility

### Manual Commits

- Click the ribbon icon (if enabled)
- Use command palette: "Commit changes"

## Development

```bash
# Install dependencies
make install

# Run in development mode (watch mode)
make dev

# Build for production
make build

# Run tests
make test

# Format code
make format

# Type check
make typecheck
```

## License

MIT
