# Genie CLI

Collaborative terminal toolkit for human + AI workflows.

## Overview

Genie CLI provides three tools for human/AI collaboration:

- **genie** - Setup and prerequisites installer
- **term** - tmux orchestration for managing terminal sessions
- **claudio** - Claude Code launcher with custom LLM routing profiles

The core idea: **tmux is the collaboration layer**. AI agents create and manage terminal sessions; humans can attach at any time to watch, assist, or take over. Both work in the same shared workspace.

---

## For Humans

### Watching Agent Work

See what sessions exist:
```bash
term ls
```

Attach to watch an agent's session:
```bash
term attach khal-tests
# or directly with tmux
tmux attach -t khal-tests
```

Read recent output without attaching:
```bash
term read khal-tests -n 200
```

### Taking Control

Once attached, you're in a normal tmux session:
- Type commands directly
- Use `Ctrl+B d` to detach
- The agent can continue working after you detach

### Quick Reference

| Task | Command |
|------|---------|
| List sessions | `term ls` |
| Attach to session | `term attach <name>` |
| Read output | `term read <name> -n 100` |
| Follow live | `term read <name> -f` |
| Kill session | `term rm <name>` |

---

## For AI Agents

### Standard Workflow

```bash
# 1. Create a session
term new khal-tests -d /path/to/project

# 2. Execute commands
term exec khal-tests "npm test"

# 3. Read output (always use --json for parsing)
term read khal-tests -n 100 --json

# 4. Clean up when done
term rm khal-tests
```

### JSON Output

Always use `--json` for reliable parsing:

```bash
# List sessions
term ls --json
# → [{"name":"khal-tests","windows":1,"created":"2025-01-30T10:00:00Z"}]

# Read output
term read khal-tests --json
# → {"session":"khal-tests","lines":["$ npm test","PASS src/app.test.ts"]}

# Check status
term status khal-tests --json
# → {"exists":true,"windows":1,"panes":1}
```

### Session Naming Convention

Use descriptive names: `<project>-<task>`
- `khal-tests` - running Khal test suite
- `khal-deploy` - deployment process
- `api-build` - building API server

### Parallel Execution

Run multiple tasks in separate windows:
```bash
term new project-work -d /path/to/project
term window new project-work tests
term window new project-work build

term exec project-work:tests "npm test"
term exec project-work:build "npm run build"
```

Or use panes within a window:
```bash
term split project-work h  # horizontal split
term exec project-work "npm test"  # runs in active pane
```

### Detecting Completion

Check if a command finished:
```bash
term status my-session --json
```

Look for shell prompt in output to detect completion:
```bash
term read my-session -n 10 --json
```

---

## genie Reference

### Prerequisites Check & Install

```bash
genie install              # Interactive prerequisite check & install
genie install --check      # Only check, don't offer to install
genie install --yes        # Auto-approve all installations
```

### What It Checks

| Prerequisite | Required | Installation Method |
|--------------|----------|---------------------|
| tmux | Yes | brew > apt/dnf/pacman > manual |
| bun | Yes | Official installer (curl) |
| claude | No (recommended) | npm global install |

### Example Output

```
🔧 Genie Prerequisites Check

System: Linux (Ubuntu) (x64)
Package Manager: apt (brew available)

Checking prerequisites...

  ✅ tmux 3.3a (/usr/bin/tmux)
  ❌ bun not found
  ⚠️  claude not found (optional)

Missing: 1 required, 1 optional

────────────────────────────────────────

Install bun? (required)
  Command: curl -fsSL https://bun.sh/install | bash
? Proceed [Y/n]: y

Installing bun...
✅ bun 1.1.0 installed

────────────────────────────────────────

Summary:
  ✅ All required prerequisites installed
  ⚠️  1 optional skipped (claude)

Run term --help or claudio --help to get started.
```

---

## term Reference

### Command Tree

```
term
├── new <name>              Create session (-d workspace, -w worktree)
├── ls                      List sessions (--json)
├── attach <name>           Attach interactively
├── rm <name>               Remove session (--keep-worktree)
├── read <session>          Read output (-n, --grep, --json, -f)
├── exec <session> <cmd>    Run command (async)
├── send <session> <keys>   Send keystrokes
├── split <session> <h|v>   Split pane (-d, -w)
├── status <session>        Check state (--command <id>, --json)
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

### Common Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON (essential for agents) |
| `-n <lines>` | Number of lines to read |
| `-f` | Follow mode (live tail) |
| `-d <path>` | Working directory |
| `-w` | Create git worktree |
| `--grep <pattern>` | Filter output by pattern |

---

## claudio Reference

### What It Does

claudio launches Claude Code with custom LLM routing profiles. It configures Claude's model mappings so requests for "opus", "sonnet", or "haiku" route to specific models via your configured router.

**Key principle**: `claude` = vanilla Anthropic, `claudio` = your custom router setup.

### When to Use

Use claudio when you need:
- **Different LLM backends** - Route to Gemini, GPT-4, or other providers
- **Cost optimization** - Map expensive tiers to cheaper models
- **Testing** - Compare behavior across different models

**Don't use claudio for**: General terminal work (use `term` instead)

### Command Reference

```
claudio                     Launch with default profile
claudio <profile>           Launch with named profile

claudio setup               First-time setup wizard
claudio profiles            List all profiles (* = default)
claudio profiles add        Add new profile (interactive picker)
claudio profiles rm <name>  Delete profile
claudio profiles default <name>  Set default profile
claudio profiles show <name>     Show profile details

claudio models              List available models from router
claudio config              Show current config (URL, default profile)
```

### Setup Wizard

Run `claudio setup` for first-time configuration:

```
$ claudio setup

🔧 Claudio Setup

? API URL: http://localhost:8317
? API Key: ********

Testing connection... ✓ Connected (47 models available)

Create your first profile:

? Profile name: main
? Select OPUS model: gemini-2.5-pro
? Select SONNET model: gemini-2.5-flash
? Select HAIKU model: gemini-2.5-flash

✓ Profile "main" created and set as default

Run `claudio` to launch, or `claudio profiles add` to create more.
```

The model picker supports type-to-filter search - just start typing to filter through available models.

### Profile Management

```bash
# List all profiles
claudio profiles
#   main *
#     opus:   gemini-2.5-pro
#     sonnet: gemini-2.5-flash
#     haiku:  gemini-2.5-flash
#   (* = default)

# Add a new profile
claudio profiles add

# Set default profile
claudio profiles default main

# Show profile details
claudio profiles show main

# Delete a profile
claudio profiles rm old-profile
```

### Configuration

Config lives in `~/.claudio/config.json`:

```json
{
  "apiUrl": "http://localhost:8317",
  "apiKey": "sk-...",
  "defaultProfile": "main",
  "profiles": {
    "main": {
      "opus": "gemini-2.5-pro",
      "sonnet": "gemini-2.5-flash",
      "haiku": "gemini-2.5-flash"
    },
    "gpt4": {
      "opus": "gpt-4o",
      "sonnet": "gpt-4o-mini",
      "haiku": "gpt-4o-mini"
    }
  }
}
```

When you run `claudio` (or `claudio main`), Claude Code launches in a tmux session with environment variables configured to route model requests through your router.

---

## Installation

```bash
# Check prerequisites first
genie install

# Build
bun install
bun run build

# Symlink to PATH
ln -s $(pwd)/dist/genie.js ~/.local/bin/genie
ln -s $(pwd)/dist/term.js ~/.local/bin/term
ln -s $(pwd)/dist/claudio.js ~/.local/bin/claudio
```

Requirements: Bun, tmux

---

## Architecture

- **Bun** - TypeScript runtime and bundler
- **Commander.js** - CLI framework
- **tmux** - Session orchestration backend

## License

MIT
