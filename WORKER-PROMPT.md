# Worker Mission: Pane Orchestration v2

You are a focused implementor agent working on the genie-cli project. Your mission is to deliver a complete, clean PR for this feature.

## The Problem

Current pane/terminal management requires manual `--pane` targeting. Workers spawn into panes but the system doesn't track pane-to-worker mapping internally. The LLM has to cognitively track which pane is which. This creates friction in parallel work scenarios.

## Context from Backlog

Read `.genie/backlog/pane-orchestration-v2.md` for full context.

Key questions to answer through design:
- What's the right abstraction? (Session-per-worker? Window-per-worker?)
- How does the system know "where" to put things?
- How to handle multi-pane workflows?
- Can we eliminate `--pane` flags entirely?

## Your Pipeline

Execute these phases IN ORDER. Do not skip any phase.

### Phase 1: Explore & Understand
- Read ALL of `src/commands/orchestrate.ts` - this is the core
- Read `src/lib/tmux/` - understand the tmux abstraction layer
- Read `src/commands/workers/` - how workers are tracked
- Read `src/lib/state/` - how state is managed
- Read `.genie/backlog/pane-orchestration-v2.md`
- Check how `term work` currently spawns workers
- Understand the current worker-to-pane relationship
- Look at existing wishes for patterns (`.genie/wishes/`)

### Phase 2: Design & Write Wish Document
Create `.genie/wishes/pane-orchestration-v2/wish.md`:

Design principles:
- **Window-per-worker** is likely the right abstraction (each worker gets its own tmux window)
- Workers track their window ID in state
- Commands like `term exec` route to the correct window automatically
- Multi-pane within a worker window is fine (e.g., editor + test runner)
- `--pane` flags become optional overrides, not requirements

The wish should have:
- Clear scope (IN: automatic window routing, state tracking. OUT: complex multi-session layouts)
- Small, testable execution groups
- Validation commands for each group

### Phase 3: Plan Review
Self-review the wish document:
- Structure complete? (Summary, Scope IN/OUT, Success Criteria, Execution Groups)
- Each group has Goal, Deliverables, Acceptance Criteria, Validation
- Criteria testable and specific
- Fix any issues

### Phase 4: Implement (Make/Forge)
For each execution group:
1. Implement changes
2. Write/update tests
3. Run validation commands
4. Verify acceptance criteria

Key files likely touched:
- `src/commands/orchestrate.ts` - worker spawning
- `src/lib/state/workers.ts` or similar - worker state
- `src/lib/tmux/` - tmux operations
- `src/commands/workers/` - worker commands

Run `bun run build` and `npx tsc --noEmit` to verify after each group.

### Phase 5: Review
- Check every success criterion
- Run all validation commands
- Verify build passes, types check
- Write review results into wish document

### Phase 6: PR
1. `git add -A`
2. `git commit` with conventional commit
3. `git push -u origin work/pane-orchestration-v2`
4. `gh pr create --base main --title "feat: automatic pane-to-worker routing (orchestration v2)" --body "..." --draft`

## Constraints
- Do NOT modify files outside scope
- Keep backward compatibility
- Don't break existing `term work` functionality
- Run build + type check before committing
- SCOPE CAREFULLY - this is a large feature. Focus on the core: window-per-worker mapping and automatic routing. Leave advanced features (multi-session, complex layouts) for later.
