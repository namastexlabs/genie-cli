# Genie CLI - AI-Friendly Terminal Orchestration

A production-ready CLI for managing tmux sessions with AI agent workflows, plus Claude Code profile management.

## Components

### term - Terminal Orchestration

AI-friendly tmux wrapper for session, window, and pane management with JSON output support.

### claudio - Claude Profile Launcher

Launch Claude Code with custom LLM router profiles.

## Installation

```bash
bun install
bun run build
```

Symlink to PATH:
```bash
ln -s $(pwd)/dist/term.js ~/.local/bin/term
ln -s $(pwd)/dist/claudio.js ~/.local/bin/genie-claudio
```

## term CLI

### Quick Start

```bash
# Create session
term new my-session

# Run command
term exec my-session "npm test"

# Read output
term read my-session -n 100

# Remove session
term rm my-session
```

### Command Reference

```
term
├── new <name>              Create session (-d workspace, -w worktree)
├── ls                      List sessions (--json)
├── attach <name>           Attach interactively
├── rm <name>               Remove session (--keep-worktree)
├── read <session>          Read output (-n, --grep, --json)
├── exec <session> <cmd>    Run command (async)
├── send <session> <keys>   Send keystrokes
├── split <session>         Split pane (h/v, -d, -w)
├── status <session>        Check session state (--command <id>, --json)
├── window
│   ├── new <session> <name>
│   ├── ls <session> (--json)
│   └── rm <window-id>
├── pane
│   ├── ls <session> (--json)
│   └── rm <pane-id>
└── hook
    ├── set <event> <cmd>
    ├── list
    └── rm <event>
```

### Session Management

```bash
term new my-session               # Create detached session
term new my-session -d /path      # With working directory
term new my-session -w            # With git worktree
term ls                           # List sessions
term ls --json                    # JSON output
term attach my-session            # Attach interactively
term rm my-session                # Kill session
```

### Command Execution

```bash
term exec my-session "npm test"   # Execute command
term send my-session "q"          # Send keystroke
term send my-session Enter        # Send Enter key
```

### Log Reading

```bash
term read my-session              # Last 100 lines
term read my-session -n 50        # Last 50 lines
term read my-session --grep "Error"  # Search pattern
term read my-session -f           # Follow mode (live tail)
term read my-session --json       # JSON output
```

### Window Management

```bash
term window new my-session main   # Create window
term window ls my-session         # List windows
term window ls my-session --json  # JSON output
term window rm @1                 # Remove by ID
```

### Pane Management

```bash
term pane ls my-session           # List all panes
term pane ls my-session --json    # JSON output
term pane rm %1                   # Remove by ID
term split my-session h           # Split horizontal
term split my-session v           # Split vertical
```

### Status Checking

```bash
term status my-session            # Session state
term status my-session --json     # JSON output
term status my-session --command <id>  # Check command result
```

## claudio CLI

### Setup

```bash
claudio setup                     # Interactive setup wizard
```

### Launch Profile

```bash
claudio gemini                    # Launch with "gemini" profile
claudio claude-max                # Launch with "claude-max" profile
claudio                           # Clear config, launch vanilla Claude
```

### Profile Configuration

Profiles map Claude model tiers to specific models:

```json
{
  "gemini": {
    "opus": "gemini-3-pro-preview",
    "sonnet": "gemini-3-flash-preview",
    "haiku": "gemini-3-flash-preview"
  }
}
```

Config file: `~/.claudio/config.json`

## Architecture

Built on:
- **Bun** - TypeScript runtime and bundler
- **Commander.js** - CLI framework
- **tmux** - Session orchestration

## License

MIT
