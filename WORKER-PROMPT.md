# Worker Mission: Upgrade Brainstorm Skill with Handoff Output

You are a focused implementor agent working on the genie-cli project. Your mission is to deliver a complete, clean PR for this feature.

## The Problem

The brainstorm skill needs to produce a structured handoff document (`design.md`) that feeds directly into the `/wish` skill. Currently brainstorm ends with verbal agreement but no artifact. Also, there are duplicate skill files (local `.claude/skills/brainstorm/` and plugin `skills/brainstorm/`) that need to be merged.

## Context

Read `.genie/backlog/upgrade-brainstorm.md` for the full wish draft (already has execution groups defined).

## Your Pipeline

Execute these phases IN ORDER. Do not skip any phase.

### Phase 1: Explore & Understand
- Read `.genie/backlog/upgrade-brainstorm.md` (has detailed execution groups already)
- Read `skills/brainstorm/SKILL.md` - the plugin version
- Check if `.claude/skills/brainstorm/` exists and compare
- Read `skills/wish/SKILL.md` to understand what wish needs from brainstorm output
- Check `skills/` directory structure for conventions

### Phase 2: Write Wish Document
Create `.genie/wishes/upgrade-brainstorm/wish.md` based on the backlog draft.

The backlog already has execution groups defined. Refine them:
- **Group A:** Create design template reference file
- **Group B:** Upgrade brainstorm SKILL.md with handoff phase
- **Group C:** Delete local duplicate (if it exists)

Add proper validation commands and tighten acceptance criteria.

### Phase 3: Plan Review
Self-review the wish document for completeness.

### Phase 4: Implement (Make/Forge)

**Group A: Design Template**
- Create `skills/brainstorm/references/design-template.md`
- Template sections: Problem, Solution, Scope IN/OUT, Key Decisions, Risks, Success Definition
- Keep it concise — this is a template, not a novel

**Group B: Upgrade SKILL.md**
- Merge best practices from both versions (if local exists)
- Add Phase 6: Write Handoff Document
- Reference the design template
- Keep all existing phases intact
- Add guidance on writing to `.genie/brainstorms/<slug>/design.md`

**Group C: Cleanup**
- Remove `.claude/skills/brainstorm/` if it exists
- Verify the plugin version works standalone

Run `bun run build` (if applicable) and verify no broken references.

### Phase 5: Review
- Check every success criterion
- Verify design template exists and is well-structured
- Verify SKILL.md has all 6 phases
- Verify no duplicate skill directories remain
- Write review results into wish

### Phase 6: PR
1. `git add -A`
2. `git commit` with conventional commit
3. `git push -u origin work/upgrade-brainstorm`
4. `gh pr create --base main --title "feat: brainstorm skill upgrade with design.md handoff" --body "..." --draft`

## Constraints
- This is a SKILL change, not a code change — no TypeScript compilation needed
- Focus on the skill files, not the CLI code
- Keep the brainstorm skill's existing phases intact
- The design template should be practical, not academic
- Do NOT modify other skills (wish, make, review)
