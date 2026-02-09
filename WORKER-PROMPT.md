# Worker Mission: Hooks v2 - Intelligent Session Awareness

You are a focused implementor agent working on the genie-cli project. Your mission is to deliver a complete, clean PR for this feature.

## The Problem

genie-cli has no hook system for Claude Code session events. Previously attempted (v1) but scripts weren't copied to plugin cache and had bun dependency issues. We need a clean, working hook system that enables:
- Wish validation before writes
- Completion awareness (did the worker finish its task?)
- Session context loading (resume wish progress automatically)

## Context from Backlog

Read `.genie/backlog/hooks-v2.md` for full context including v1 problems and design ideas.

## Your Pipeline

Execute these phases IN ORDER. Do not skip any phase.

### Phase 1: Explore & Understand
- Read `.genie/backlog/hooks-v2.md` thoroughly
- Read `plugins/automagik-genie/` - the plugin structure
- Check how Claude Code hooks work: `.claude/hooks/` or `settings.json` hooks format
- Read existing `src/lib/state/` for session/wish state management
- Understand what hook events Claude Code supports (PreToolUse, PostToolUse, Stop, etc.)
- Check Claude Code docs or `claude --help` for hook configuration

### Phase 2: Design & Write Wish Document
Create `.genie/wishes/hooks-v2/wish.md`:

Design decisions to make:
- **Script-based hooks** (self-contained .js/.cjs, no bun dependency) vs **prompt-based hooks**
- Start with the MINIMUM VIABLE set of hooks:
  1. **Wish validation hook** (PreToolUse on Write to `.genie/wishes/**`) - validates structure
  2. **Session context hook** (on session start or resume) - loads active wish context
- Defer completion awareness to a follow-up (complex, needs careful design)

Key constraints:
- Scripts MUST be self-contained `.js` or `.cjs` (no bun, no external deps)
- Scripts must be copied correctly to plugin cache on install
- Must work with both Claude Code plugin system AND standalone

The wish should have:
- Tight scope (2-3 hooks maximum, not the full vision)
- Each hook as its own execution group
- Clear validation commands

### Phase 3: Plan Review
Self-review the wish document for completeness.

### Phase 4: Implement (Make/Forge)
For each execution group:
1. Create the hook scripts (self-contained .js)
2. Wire them into the plugin manifest / settings
3. Test that hooks fire correctly
4. Verify scripts are self-contained (no external requires)

Key files likely touched:
- `plugins/automagik-genie/` - plugin manifest, scripts/
- `.claude/settings.json` or hook config files
- New hook scripts in the plugin
- Install script if needed for proper file copying

Run `bun run build` and `npx tsc --noEmit` to verify.

### Phase 5: Review
- Check every success criterion
- Run all validation commands
- Verify hooks fire in a test scenario
- Write review results into wish

### Phase 6: PR
1. `git add -A`
2. `git commit` with conventional commit
3. `git push -u origin work/hooks-v2`
4. `gh pr create --base main --title "feat: hooks v2 - wish validation and session context" --body "..." --draft`

## Constraints
- Scripts MUST be self-contained (no bun, no npm packages)
- Do NOT break existing plugin functionality
- Keep scope tight - 2-3 hooks max
- Run build + type check before committing
- Test hooks manually if possible (create a test wish file, trigger the hook)
