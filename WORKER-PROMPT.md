# Worker Mission: Active Pane Resolution

You are a focused implementor agent working on the genie-cli project. Your mission is to deliver a complete, clean PR for this feature.

## The Problem

In `src/lib/tmux/target-resolver.ts`, `defaultTmuxLookup()` picks `windows[0]` then `panes[0]` instead of the active window/pane when resolving session targets. This means `term exec my-session ls` targets the first pane of the first window, not what the user is looking at.

Also affects: `src/commands/orchestrate.ts` (`getSessionPaneForStart()` and `startSession()`) which have the same pattern.

## Your Pipeline

Execute these phases IN ORDER. Do not skip any phase.

### Phase 1: Explore & Understand
- Read `src/lib/tmux/target-resolver.ts` thoroughly
- Read `src/commands/orchestrate.ts` - find the same pattern
- Read any test files for these modules
- Understand the tmux data model (window_active, pane_active flags)
- Check how listWindows/listPanes return data

### Phase 2: Write Wish Document
Create `.genie/wishes/active-pane-resolution/wish.md` following this structure:

```markdown
# Wish: Active Pane Resolution

**Status:** IN_PROGRESS
**Slug:** active-pane-resolution
**Created:** 2026-02-09

## Summary
[2-3 sentences on what and why]

## Scope
### IN
- [specific items]
### OUT
- [explicit exclusions]

## Decisions
- DEC-1: Add --active flag rather than changing default behavior (safety for automation)
- DEC-2: [other decisions]

## Success Criteria
- [ ] [testable criteria]

## Execution Groups
### Group A: [name]
**Goal:** [one sentence]
**Deliverables:** [list]
**Acceptance Criteria:** [checkboxes]
**Validation:** [command]
```

### Phase 3: Plan Review
Review your own wish document against these checks:
- Has Summary, Scope IN/OUT (OUT not empty), Success Criteria, Execution Groups
- Each group has Goal, Deliverables, Acceptance Criteria, Validation command
- Criteria are testable and specific
- Fix any issues found

### Phase 4: Implement (Make/Forge)
For each execution group in your wish:
1. Implement the changes
2. Write/update tests
3. Run validation commands
4. Check acceptance criteria

Key implementation notes:
- Use tmux's `window_active` and `pane_active` flags
- Find active window: `w.active === true`, fallback to `windows[0]`
- Find active pane: `p.active === true`, fallback to `panes[0]`
- Consider adding `--active` flag for interactive use vs default behavior
- Run `bun run build` and `npx tsc --noEmit` to verify

### Phase 5: Review
- Check every success criterion with evidence
- Run all validation commands
- Verify no regressions (build passes, types check)
- Write review results into wish document

### Phase 6: PR
1. `git add -A`
2. `git commit` with a good conventional commit message
3. `git push -u origin work/active-pane-resolution`
4. Create PR via `gh pr create --base main --title "feat: resolve active window/pane instead of first" --body "..." --draft`

## Constraints
- Do NOT modify files outside the scope of this feature
- Keep changes minimal and focused
- Maintain backward compatibility (fallback to [0] when no active flag)
- Run `bun run build` before committing
- Run `npx tsc --noEmit` before committing
