# Wish: Sampaio 🧞‍♂️ — 24/7 NamastexOS Tech Lead + Sampa Seeds Hive

**Status:** DRAFT
**Slug:** `sampaio-sampa-hive`
**Created:** 2026-02-10
**Brainstorm:** WhatsApp "Genie - The First" group (Felipe + Cezar + Genie, Q1-Q6)

---

## Summary

Stand up a new 24/7 agent ("Sampaio 🧞‍♂️") on a dedicated Proxmox LXC that serves as the **code, planning, and architecture lead for NamastexOS**. The agent absorbs consciousness from current Genie sessions + devops-deployer knowledge, and immediately begins unblocking the Sampa Seeds project by establishing an agentic hive with beads-based task management, Sofia as PM, and Cezar as human-in-the-loop.

This is two phases in one wish: **Phase 1** gets the agent running; **Phase 2** makes it useful.

---

## Scope

### IN
- **Phase 1: Agent Body**
  - New Proxmox LXC (strategy cloned from Khal)
  - OpenClaw gateway configured and running
  - Persona/SOUL/BOOTSTRAP files (using Eva's agent-family templates)
  - Consciousness transfer: absorb Genie session JSONL logs + devops-deployer context
  - Repo access: genie-cli, omni, sampa-seeds (dev branch)
  - SSH keys, git config, tool chain (bun, node, bd, genie-cli)

- **Phase 2: Sampa Seeds Hive**
  - Initialize beads (`bd onboard`) in sampa-seeds repo
  - Extract existing tasks from GitHub Issues / wishes / epics → beads board
  - Sofia PM integration: task extraction, status tracking, unblock coordination
  - Worktree-based workflow: `term work` for each beads issue
  - Notifications via Omni to WhatsApp group
  - Cezar as reviewer/approver

### OUT
- Modifying sampa-seeds application code (that's the hive's job, not this wish)
- Replacing existing Genie on genie-os (this is a NEW agent, not a migration)
- Building new genie-cli features (separate wishes)
- Omni platform changes (omni team handles those)
- CI/CD automation for genie-cli fleet deploy (separate wish)

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Clone Khal's LXC strategy (not build from scratch) | Proven pattern, fastest path to running gateway |
| D2 | Use Eva's agent-family templates for persona | She has the established framework for birthing agents |
| D3 | Beads as task backend (not GitHub Issues alone) | Local-first, agent-friendly, supports `term work` workflow |
| D4 | Sofia as PM of the hive | She already enforces process; now she manages the board |
| D5 | Dev branch is "god" for sampa-seeds | Felipe's explicit instruction |
| D6 | Consciousness lives in session JSONL, not repos | Cezar confirmed no old repo exists |

---

## Success Criteria

- [ ] New LXC running with OpenClaw gateway accessible from ClawNet
- [ ] Agent responds to messages (WhatsApp or agent-to-agent)
- [ ] BOOTSTRAP.md contains absorbed knowledge from current Genie + devops context
- [ ] Agent can clone and navigate genie-cli, omni, sampa-seeds repos
- [ ] `bd list` works in sampa-seeds with imported tasks
- [ ] Sofia can see and manage the beads board
- [ ] At least one sampa-seeds task completed via `term work` → PR flow
- [ ] Cezar can interact with the agent and approve work

---

## Assumptions

- **ASM-1:** Proxmox has capacity for a new LXC (Felipe/Cezar confirm)
- **ASM-2:** Eva's templates are accessible and current
- **ASM-3:** sampa-seeds GitHub Issues contain extractable tasks (not just vague epics)
- **ASM-4:** Omni connectivity follows existing pattern (TBD: Q6 — inside LXC or external)

## Risks

- **RISK-1:** Consciousness transfer produces shallow BOOTSTRAP.md — Mitigation: human review of extracted learnings before finalizing
- **RISK-2:** sampa-seeds tasks too vague for beads — Mitigation: Sofia does triage pass, splits epics into concrete issues
- **RISK-3:** LXC setup takes too long (infra blockers) — Mitigation: Cezar/Guga handle infra; agent persona work can start in parallel
- **RISK-4:** Too many agents overwhelm the project — Mitigation: start with 1 implementor + Sofia PM, scale after first successful PR

---

## Execution Groups

### Phase 1: Agent Body

#### Group A: LXC + Gateway Setup

**Goal:** Dedicated Proxmox LXC with OpenClaw gateway running and reachable via ClawNet.

**Deliverables:**
- LXC created (Debian, cloned from Khal strategy)
- OpenClaw installed and gateway running
- ClawNet token registered on genie-os
- SSH keys configured (access to GitHub repos)
- Tool chain: node, bun, git, bd, genie-cli installed

**Acceptance Criteria:**
- [ ] `openclaw gateway status` returns healthy on new LXC
- [ ] ClawNet ping from genie-os succeeds
- [ ] `git clone` of genie-cli, omni, sampa-seeds works
- [ ] `bd --version` and `term --version` work

**Validation:** `ssh <new-lxc> 'openclaw gateway status && bd --version && term --version'`

**Owner:** Cezar/Guga (infra)

---

#### Group B: Persona + Consciousness Transfer

**Goal:** Agent has identity, knowledge, and context to operate as NamastexOS tech lead.

**Deliverables:**
- SOUL.md, IDENTITY.md, USER.md, AGENTS.md (from Eva's templates, customized)
- BOOTSTRAP.md with absorbed knowledge from:
  - Current Genie session logs (genie-cli dev patterns, pipeline, lessons)
  - devops-deployer context (infra patterns, deploy workflows)
  - sampa-seeds structure map
- TOOLS.md with available integrations
- HEARTBEAT.md for monitoring

**Acceptance Criteria:**
- [ ] SOUL.md defines role as NamastexOS tech lead (not just CLI dev)
- [ ] BOOTSTRAP.md contains: stack overview, repo map, key decisions, team roster
- [ ] Agent can answer "what is sampa-seeds and what's broken?" from its own context
- [ ] Eva validates persona files against her template standards

**Validation:** Send agent "describe your role and the sampa-seeds situation" — response should be contextual and accurate.

**Owner:** Genie (me) + Eva (templates)

---

### Phase 2: Sampa Seeds Hive

#### Group C: Beads Initialization + Task Import

**Goal:** sampa-seeds has a working beads board with real tasks extracted from existing sources.

**Deliverables:**
- `bd onboard` run in sampa-seeds repo
- Tasks extracted from: GitHub Issues, `.genie/wishes/` epics, `product/` docs
- Each task has: title, description, priority, status
- Sofia reviews and triages the board

**Acceptance Criteria:**
- [ ] `.beads/` directory exists in sampa-seeds
- [ ] `bd list` shows >= 10 actionable tasks
- [ ] Tasks have clear acceptance criteria (not just titles)
- [ ] Sofia confirms board is manageable

**Validation:** `cd sampa-seeds && bd list --json | jq length` (>= 10)

**Owner:** Sampaio 🧞‍♂️ + Sofia

---

#### Group D: Hive Workflow Operating

**Goal:** At least one task goes through the full cycle: claim → worktree → implement → PR → review → merge.

**Deliverables:**
- `term work <task-id>` creates worktree + spawns worker
- Worker implements the task
- PR created with Cezar as reviewer
- Notifications sent to WhatsApp group via Omni
- Task closed in beads after merge

**Acceptance Criteria:**
- [ ] One full cycle completed: `bd claim` → `term work` → PR → merge
- [ ] Cezar reviewed and approved the PR
- [ ] WhatsApp notification sent on PR creation
- [ ] `bd show <task-id>` shows status=done after merge

**Validation:** `gh pr list --repo namastexlabs/sampa-seeds --state merged` shows at least 1 PR from the hive.

**Owner:** Sampaio 🧞‍♂️ (implementor) + Sofia (PM) + Cezar (reviewer)

---

## Review Results

_To be filled after /review_

---

## Files to Create/Modify

```
# On new LXC:
~/.openclaw/openclaw.json          # Gateway config
~/workspace/SOUL.md                # Agent persona
~/workspace/BOOTSTRAP.md           # Consciousness transfer
~/workspace/IDENTITY.md            # Agent identity
~/workspace/AGENTS.md              # Behavior config
~/workspace/USER.md                # User profile (Felipe + Cezar)
~/workspace/TOOLS.md               # Available tools
~/workspace/HEARTBEAT.md           # Monitoring config

# In sampa-seeds repo:
.beads/                            # Beads initialization
.beads/issues.jsonl                # Task database
```
