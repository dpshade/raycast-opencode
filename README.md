# OpenCode for Raycast

A Raycast extension for [OpenCode](https://opencode.ai) - AI coding assistant with full project context, session management, and seamless terminal handoff.

## Features

- **Ask OpenCode** - Quick coding questions directly from Raycast with streaming responses
- **Full-Text Session Search** - Search across session titles, directories, and message content using FlexSearch
- **Multi-Terminal Support** - Open sessions in Ghostty, iTerm, Warp, Kitty, Alacritty, Hyper, or Terminal.app
- **@path Context** - Use `@~/path/to/project` to specify working directory with autocomplete
- **Model Selector** - Switch between providers and models on the fly
- **Agent Selection** - Type `@` to select from available agents
- **Slash Commands** - Type `/` to access built-in commands
- **Session Handoff** - Continue conversations in your terminal or OpenCode Desktop

## Installation

### Prerequisites

1. Install OpenCode CLI:
   ```bash
   curl -fsSL https://opencode.ai/install | bash
   ```

2. Verify the server can start:
   ```bash
   opencode serve
   ```

### Install Extension

Install from Raycast Store, or build from source:

```bash
git clone https://github.com/dpshade22/raycast-opencode.git
cd raycast-opencode
bun install
bun run dev
```

## Usage

### Ask OpenCode

1. Open Raycast and search for "Ask OpenCode"
2. Type your question
3. Optionally add `@~/path/to/project` for project context
4. Press Enter to get a response
5. Press `Cmd+O` to continue in your terminal

### Recent Sessions

1. Open Raycast and search for "Recent Sessions"
2. Type to search across session titles and message content
3. Press Enter to open a session in your configured terminal

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Submit question | `Enter` |
| Submit and close | `Cmd+Shift+Enter` |
| Continue in terminal | `Cmd+O` |
| Copy response | `Cmd+C` |
| Copy session command | `Cmd+Shift+C` |
| New question | `Cmd+N` |
| Delete session | `Cmd+Backspace` |
| Refresh | `Cmd+R` |

### Agent Selection

Type `@` followed by agent name:
- `@build` - Default agent for development work
- `@plan` - Read-only agent for analysis and planning

### Directory Context

Use `@path` syntax to specify project context:
- `@~/Developer/myproject` - Use specific directory
- Autocomplete suggestions appear as you type

### Slash Commands

Type `/` to access commands:
- `/clear` - Clear conversation
- `/compact` - Compact context
- `/share` - Copy share URL

## Configuration

Open Raycast Preferences > Extensions > OpenCode:

| Setting | Description |
|---------|-------------|
| **Default Project** | Default working directory for new sessions |
| **Handoff Method** | Terminal (CLI) or Desktop app |
| **Terminal Application** | Ghostty, iTerm, Warp, Kitty, Alacritty, Hyper, or Terminal.app |
| **Auto-start Server** | Automatically start OpenCode server if not running |

## Architecture

```
src/
  ask.tsx              # Main "Ask OpenCode" command
  sessions.tsx         # Session browser with full-text search
  projects.tsx         # Project picker
  hooks/
    useOpenCode.ts     # OpenCode API client hook
    useProviders.ts    # Model/provider management
    useProjects.ts     # Recent projects storage
    useSessionSearch.ts # FlexSearch indexing + caching
    usePathAutocomplete.ts # @path autocomplete
  lib/
    opencode.ts        # OpenCode HTTP client
    handoff.ts         # Terminal app launchers
    server-manager.ts  # Auto-start server logic
```

## Session Search

The extension indexes the last 10 messages of each session for full-text search:

- Progressive indexing in 4 batches (25% each) for responsiveness
- Cached to Raycast LocalStorage between launches
- Re-indexes when session timestamps change
- Prefix matching for partial searches

## Terminal Support

Sessions can be opened in any of these terminals:

| Terminal | Method |
|----------|--------|
| Ghostty | `open -a Ghostty --args -e` |
| iTerm | AppleScript with `write text` |
| Warp | URI scheme + System Events |
| Kitty | `kitty --directory` |
| Alacritty | `alacritty --working-directory` |
| Hyper | System Events keystroke |
| Terminal.app | AppleScript `do script` |

Falls back to copying command to clipboard if terminal launch fails.

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Type check
npx tsc --noEmit

# Lint
bun run lint

# Build
bun run build
```

## License

MIT
