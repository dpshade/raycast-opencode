# AGENTS.md - AI Coding Assistant Guidelines

This document provides context for AI coding assistants working on this codebase.

## Project Overview

A Raycast extension for OpenCode - an AI coding assistant. The extension provides quick access to OpenCode from Raycast with session management, full-text search, and terminal handoff.

## Tech Stack

- **Runtime**: Raycast Extension (React + Node.js)
- **Language**: TypeScript (strict mode)
- **Package Manager**: bun (preferred) or npm
- **Build**: Raycast CLI (`ray build`)
- **Search**: FlexSearch for session indexing

## Project Structure

```
src/
  ask.tsx              # Main "Ask OpenCode" command - question input, response display
  sessions.tsx         # Session list with search, delete, handoff actions
  projects.tsx         # Recent projects picker
  
  hooks/
    useOpenCode.ts     # Core hook - connects to OpenCode server, manages sessions
    useProviders.ts    # Fetches available AI providers/models
    useProjects.ts     # Persists recently used project directories
    useSessionSearch.ts # FlexSearch indexing with LocalStorage caching
    usePathAutocomplete.ts # @path autocomplete with filesystem traversal
    
  lib/
    opencode.ts        # HTTP client for OpenCode API (localhost:4096)
    handoff.ts         # Terminal app launchers (Ghostty, iTerm, etc.)
    server-manager.ts  # Auto-starts OpenCode server if not running
```

## Key Patterns

### Raycast API Usage

```typescript
import { List, ActionPanel, Action, showToast, Toast, getPreferenceValues } from "@raycast/api"
```

- Use `getPreferenceValues<T>()` for typed preferences
- Use `showToast()` for user feedback
- Use `showHUD()` for quick confirmations
- Use `LocalStorage` for persistent caching

### OpenCode API

The extension communicates with OpenCode server at `localhost:4096`:

```typescript
const client = await getClient()
const sessions = await client.listSessions()
const messages = await client.getMessages(sessionId, limit)
```

Key endpoints:
- `GET /session` - List all sessions
- `GET /session/:id` - Get session details
- `GET /session/:id/message?limit=N` - Get messages
- `DELETE /session/:id` - Delete session
- `POST /session/:id/message` - Send message

### Terminal Handoff

The `handoff.ts` module launches terminals with session commands:

```typescript
export type TerminalApp = "default" | "ghostty" | "iterm" | "warp" | "alacritty" | "kitty" | "terminal" | "hyper"

await handoffToOpenCode(sessionId, "terminal", workingDir, terminalApp)
```

Each terminal has a specific launch strategy (AppleScript, CLI flags, etc.).

### Session Search

FlexSearch indexes sessions progressively:

```typescript
const { searchText, setSearchText, filteredSessions, isIndexing } = useSessionSearch(sessions)
```

- Indexes title + directory + last 10 message texts
- Caches to LocalStorage with timestamp validation
- Re-indexes when session `updated` timestamp changes

## Preferences Schema

Defined in `package.json`:

| Name | Type | Description |
|------|------|-------------|
| `defaultProject` | directory | Default working directory |
| `handoffMethod` | dropdown | "terminal" or "desktop" |
| `terminalApp` | dropdown | Terminal app selection |
| `autoStartServer` | checkbox | Auto-start OpenCode server |

## Common Tasks

### Adding a New Terminal

1. Add to `TerminalApp` type in `handoff.ts`
2. Add config to `TERMINAL_CONFIGS` with `openCommand` function
3. Add dropdown option in `package.json` preferences

### Adding a New Command

1. Create new `.tsx` file in `src/`
2. Add command entry in `package.json` under `commands`
3. Export default React component

### Modifying Search Behavior

Edit `useSessionSearch.ts`:
- `BATCH_SIZE` controls indexing chunks
- `MESSAGES_TO_INDEX` controls depth
- `buildSearchText()` controls what gets indexed

## Code Style

- No comments unless explaining complex algorithms
- Self-documenting function and variable names
- Prefer early returns over nested conditionals
- Use async/await over .then() chains
- Type all function parameters and return values

## Testing

```bash
# Type check
npx tsc --noEmit

# Run in dev mode
bun run dev
# Then test in Raycast
```

## Common Gotchas

1. **Raycast environment**: Extensions run in sandboxed Node.js, not browser
2. **execAsync for terminals**: Use `child_process.exec` with proper escaping
3. **AppleScript escaping**: Double-escape quotes for osascript commands
4. **LocalStorage limits**: Raycast LocalStorage has size limits - index selectively
5. **Server connection**: OpenCode server must be running on port 4096

## Dependencies

Core:
- `@raycast/api` - Raycast extension framework
- `@raycast/utils` - Utility hooks
- `flexsearch` - Full-text search indexing

Dev:
- `typescript` - Type checking
- `eslint` - Linting via Raycast config
