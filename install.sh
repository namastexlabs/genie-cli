#!/usr/bin/env bash
set -e

# Genie CLI Installer/Updater
# https://github.com/namastexlabs/genie-cli
#
# Usage:
#   Fresh install: curl -fsSL https://raw.githubusercontent.com/namastexlabs/genie-cli/main/install.sh | bash
#   Update:        Run install.sh again OR `genie update`

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Paths
GENIE_HOME="${GENIE_HOME:-$HOME/.genie}"
GENIE_SRC="$GENIE_HOME/src"
GENIE_BIN="$GENIE_HOME/bin"
LOCAL_BIN="$HOME/.local/bin"
REPO_URL="https://github.com/namastexlabs/genie-cli.git"

# Detect mode: install vs update
if [[ -d "$GENIE_SRC/.git" ]]; then
    MODE="update"
else
    MODE="install"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

log() {
    echo -e "${GREEN}▸${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✖${NC} $1"
}

success() {
    echo -e "${GREEN}✔${NC} $1"
}

header() {
    echo
    echo -e "${BOLD}$1${NC}"
    echo
}

check_command() {
    command -v "$1" &> /dev/null
}

# Run a command with visible output
run() {
    echo -e "${DIM}$ $*${NC}"
    "$@"
}

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisite Checks & Installation
# ─────────────────────────────────────────────────────────────────────────────

check_prerequisites() {
    local missing=()

    if ! check_command git; then
        missing+=("git")
    fi

    if ! check_command curl; then
        missing+=("curl")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing[*]}"
        echo "Please install them and run this script again."
        exit 1
    fi
}

install_nvm_and_node() {
    # Check if Node 22+ is already available
    if check_command node; then
        local node_version
        node_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
        if [[ "$node_version" -ge 22 ]]; then
            success "Node.js v$(node --version | sed 's/v//') already installed"
            return 0
        fi
    fi

    # Check if nvm is installed
    if [[ -z "$NVM_DIR" ]]; then
        export NVM_DIR="$HOME/.nvm"
    fi

    if [[ ! -d "$NVM_DIR" ]]; then
        log "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

        # Source nvm immediately
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    else
        # Source existing nvm
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi

    # Install Node 22
    log "Installing Node.js 22 via nvm..."
    nvm install 22
    nvm use 22
    nvm alias default 22

    success "Node.js $(node --version) installed"
}

install_bun() {
    if check_command bun; then
        success "Bun $(bun --version) already installed"
        return 0
    fi

    log "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash

    # Add bun to PATH for this session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if check_command bun; then
        success "Bun $(bun --version) installed"
    else
        error "Bun installation failed"
        exit 1
    fi
}

install_tmux() {
    if check_command tmux; then
        success "tmux $(tmux -V | cut -d' ' -f2) already installed"
        return 0
    fi

    log "Installing tmux..."

    # Detect package manager
    if check_command apt; then
        sudo apt update && sudo apt install -y tmux
    elif check_command dnf; then
        sudo dnf install -y tmux
    elif check_command yum; then
        sudo yum install -y tmux
    elif check_command pacman; then
        sudo pacman -S --noconfirm tmux
    elif check_command brew; then
        brew install tmux
    else
        warn "Could not detect package manager. Please install tmux manually."
        warn "Visit: https://github.com/tmux/tmux/wiki/Installing"
        return 1
    fi

    if check_command tmux; then
        success "tmux $(tmux -V | cut -d' ' -f2) installed"
    else
        error "tmux installation failed"
        return 1
    fi
}

install_claude_code() {
    if check_command claude; then
        success "Claude Code CLI already installed"
        return 0
    fi

    log "Installing Claude Code CLI..."

    # Ensure npm is available (should be after nvm install)
    if ! check_command npm; then
        error "npm not found. Please ensure Node.js is installed."
        return 1
    fi

    npm install -g @anthropic-ai/claude-code

    if check_command claude; then
        success "Claude Code CLI installed"
    else
        warn "Claude Code installed but not in PATH yet"
        warn "You may need to restart your shell"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Build & Install
# ─────────────────────────────────────────────────────────────────────────────

clone_repo() {
    log "Cloning genie-cli repository..."
    mkdir -p "$GENIE_HOME"
    git clone "$REPO_URL" "$GENIE_SRC"
    success "Repository cloned to $GENIE_SRC"
}

update_repo() {
    log "Updating genie-cli..."
    cd "$GENIE_SRC"
    git fetch origin
    git reset --hard origin/main
    success "Repository updated to latest main"
}

build_project() {
    log "Building genie-cli..."
    cd "$GENIE_SRC"

    # Install dependencies
    bun install

    # Build
    bun run build

    success "Build complete"
}

install_binaries() {
    log "Installing binaries..."

    # Create directories
    mkdir -p "$GENIE_BIN"
    mkdir -p "$LOCAL_BIN"

    # Copy built files to ~/.genie/bin
    cp "$GENIE_SRC/dist/genie.js" "$GENIE_BIN/"
    cp "$GENIE_SRC/dist/term.js" "$GENIE_BIN/"
    cp "$GENIE_SRC/dist/claudio.js" "$GENIE_BIN/"
    chmod +x "$GENIE_BIN"/*.js

    # Create symlinks in ~/.local/bin
    ln -sf "$GENIE_BIN/genie.js" "$LOCAL_BIN/genie"
    ln -sf "$GENIE_BIN/term.js" "$LOCAL_BIN/term"
    ln -sf "$GENIE_BIN/claudio.js" "$LOCAL_BIN/claudio"

    success "Binaries installed to $GENIE_BIN"
    success "Symlinks created in $LOCAL_BIN"
}

ensure_path() {
    # Check if ~/.local/bin is in PATH
    if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
        warn "$LOCAL_BIN is not in your PATH"
        echo
        echo "Add this to your shell profile (~/.bashrc or ~/.zshrc):"
        echo -e "${CYAN}  export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        echo
    fi
}

run_setup() {
    log "Running genie setup..."
    echo

    # Run quick setup
    if check_command genie; then
        genie setup --quick
    else
        # Fallback: run directly
        "$GENIE_BIN/genie.js" setup --quick
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
    echo
    echo -e "${BOLD}🧞 Genie CLI ${MODE^}er${NC}"
    echo -e "${DIM}────────────────────────────────────${NC}"
    echo

    if [[ "$MODE" == "update" ]]; then
        # Update mode: just pull and rebuild
        header "Updating Genie CLI..."

        update_repo
        build_project
        install_binaries

        echo
        echo -e "${DIM}────────────────────────────────────${NC}"
        success "Genie CLI updated successfully!"
        echo
        echo "Commands available:"
        echo -e "  ${CYAN}genie${NC}   - Setup and utilities"
        echo -e "  ${CYAN}term${NC}    - Terminal orchestration"
        echo -e "  ${CYAN}claudio${NC} - Claude profile manager"
        echo

    else
        # Fresh install mode
        header "Checking prerequisites..."

        check_prerequisites
        install_nvm_and_node
        install_bun
        install_tmux || true  # Don't fail if tmux fails
        install_claude_code || true  # Don't fail if claude fails

        header "Installing Genie CLI..."

        clone_repo
        build_project
        install_binaries
        ensure_path

        header "Setting up Genie..."

        run_setup

        echo
        echo -e "${DIM}────────────────────────────────────${NC}"
        success "Genie CLI installed successfully!"
        echo
        echo "Commands available:"
        echo -e "  ${CYAN}genie${NC}   - Setup and utilities"
        echo -e "  ${CYAN}term${NC}    - Terminal orchestration"
        echo -e "  ${CYAN}claudio${NC} - Claude profile manager"
        echo
        echo "Get started:"
        echo -e "  ${CYAN}genie --help${NC}"
        echo -e "  ${CYAN}term --help${NC}"
        echo -e "  ${CYAN}claudio --help${NC}"
        echo
    fi
}

main "$@"
