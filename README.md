# Claudio - Claude CLI Wrapper with tmux Orchestration

A production-ready CLI application for managing multiple Claude instances with custom model profiles and full tmux control.

## Features

- **Custom Model Profiles** - Map opus/sonnet/haiku tiers to any LLM model
- **tmux Session Management** - Run multiple Claude instances in isolated sessions
- **Full tmux Control** - 13 commands for session/window/pane management
- **Vanilla Fallback** - Reset to default Claude behavior with zero config

## Installation

```bash
bun install -g @namastexlabs/claudio
```

## Quick Start

### 1. Setup

Run the interactive setup wizard:

```bash
claudio setup
```

You'll be prompted to:
- Enter your API URL (default: claude-router at 10.114.1.119:8317)
- Enter your API key
- Create one or more profiles with model mappings

### 2. Launch a Profile

```bash
claudio gemini              # Opens tmux session "gemini-1"
claudio claude-max          # Opens tmux session "claude-max-1"
claudio gemini              # Opens second instance "gemini-2"
```

### 3. Vanilla Reset

Clear all configuration and run default Claude:

```bash
claudio                     # Deletes config, runs vanilla claude
```

## Profile Configuration

Each profile maps the three Claude model tiers to specific models:

```json
{
  "gemini": {
    "opus": "gemini-3-pro-preview",
    "sonnet": "gemini-3-flash-preview",
    "haiku": "gemini-3-flash-preview"
  },
  "claude-max": {
    "opus": "claude-opus-4-5-20251101",
    "sonnet": "claude-opus-4-5-20251101",
    "haiku": "claude-opus-4-5-20251101"
  }
}
```

Config file: `~/.claudio/config.json`

## tmux Commands

### Session Management

```bash
claudio session list                    # List all sessions
claudio session create test-session     # Create new session
claudio session kill gemini-1           # Kill session
claudio session find gemini-1           # Find session by name
```

### Window Management

```bash
claudio window list <session-id>                  # List windows
claudio window create <session-id> <name>         # Create window
claudio window kill <window-id>                   # Kill window
```

### Pane Management

```bash
claudio pane list <window-id>                     # List panes
claudio pane split <pane-id> --horizontal         # Split pane
claudio pane split <pane-id> --vertical           # Split pane (default)
claudio pane kill <pane-id>                       # Kill pane
claudio pane capture <pane-id> --lines 50         # Capture output
```

### Command Execution

```bash
claudio command execute <pane-id> "echo test"     # Execute command
claudio command execute <pane-id> "vim" --raw     # Raw mode (no tracking)
claudio command get-result <command-id>           # Get result
```

## Session Naming

Sessions follow the format `<profile>-<number>`:

- First instance: `gemini-1`
- Second instance: `gemini-2`
- Different profile: `claude-max-1`

Numbers auto-increment for multiple sessions with the same profile.

## Requirements

- Bun runtime
- tmux binary
- claude CLI (`@anthropic-ai/claude-code`)

## Development

```bash
# Install dependencies
bun install

# Development mode (hot reload)
bun run dev

# Build
bun run build

# Test locally
bun link
claudio setup
```

## Architecture

Built on:
- **Bun** - TypeScript runtime and bundler
- **Commander.js** - CLI framework
- **Zod** - Configuration validation
- **tmux** - Session orchestration

Core components:
- `config.ts` - Configuration management
- `tmux.ts` - tmux abstraction (from tmux-mcp)
- `wizard.ts` - Interactive setup
- `launch.ts` - Profile launcher
- Command handlers for all tmux operations

## License

MIT
