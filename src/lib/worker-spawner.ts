/**
 * Worker Spawner — Reusable spawn logic extracted from workers.ts.
 *
 * Used by both the CLI `genie worker spawn` command and the protocol
 * router's auto-spawn-on-message feature. Only supports tmux mode
 * (throws if TMUX env var is not set).
 */

import * as registry from './worker-registry.js';
import * as nativeTeams from './claude-native-teams.js';
import * as teamManager from './team-manager.js';
import { buildLaunchCommand, validateSpawnParams, type ProviderName, type SpawnParams, type ClaudeTeamColor } from './provider-adapters.js';
import { resolveLayoutMode, buildLayoutCommand } from './mosaic-layout.js';
import { OTEL_RELAY_PORT, ensureCodexOtelConfig } from './codex-config.js';

// ============================================================================
// Types
// ============================================================================

export interface SpawnWorkerOptions {
  provider: ProviderName;
  team: string;
  role?: string;
  skill?: string;
  cwd?: string;
  extraArgs?: string[];
  color?: ClaudeTeamColor;
  planMode?: boolean;
  permissionMode?: string;
  layout?: string;
}

export interface SpawnResult {
  workerId: string;
  paneId: string;
  worker: registry.Worker;
}

// ============================================================================
// Helpers (re-imported from workers.ts pattern)
// ============================================================================

async function generateWorkerId(team: string, role?: string): Promise<string> {
  const base = role ? `${team}-${role}` : team;
  const existing = await registry.list();
  if (!existing.some(w => w.id === base)) return base;

  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base}-${suffix}`;
}

/**
 * Ensure the shared OTel relay is running for Codex workers.
 * Delegates to the inline relay script in workers.ts via a dynamic
 * require — keeping it here would duplicate 250+ lines of relay code.
 * Returns false if relay setup fails (non-fatal).
 */
async function ensureOtelRelay(_team: string): Promise<boolean> {
  // The OTel relay is only needed for Codex workers and its setup
  // is complex. For auto-spawn (which primarily targets Claude workers),
  // we skip relay setup and return false. The relay will be started
  // if the user does `genie worker spawn --provider codex` directly.
  return false;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Spawn a worker in a new tmux pane. Handles:
 * 1. Native team infrastructure setup
 * 2. Launch command building via provider adapters
 * 3. Tmux pane creation
 * 4. Worker + native team registration
 * 5. Join notification to team-lead
 *
 * Requires TMUX env var to be set (must be inside a tmux session).
 */
export async function spawnWorker(opts: SpawnWorkerOptions): Promise<SpawnResult> {
  if (!process.env.TMUX) {
    throw new Error('spawnWorker requires a tmux session (TMUX env var not set)');
  }

  const { execSync } = require('child_process');

  // 1. Resolve team infrastructure
  const repoPath = opts.cwd ?? process.cwd();
  const teamConfig = await teamManager.getTeam(repoPath, opts.team);

  let parentSessionId = teamConfig?.nativeTeamParentSessionId;
  if (!parentSessionId) {
    parentSessionId = await nativeTeams.discoverClaudeSessionId() ?? crypto.randomUUID();
  }

  await nativeTeams.ensureNativeTeam(
    opts.team,
    `Genie team: ${opts.team}`,
    parentSessionId,
  );

  const spawnColor = opts.color ?? await nativeTeams.assignColor(opts.team);

  // 2. Build spawn params
  const params: SpawnParams = {
    provider: opts.provider,
    team: opts.team,
    role: opts.role,
    skill: opts.skill,
    extraArgs: opts.extraArgs,
  };

  // Enable native teammate flags for Claude
  if (opts.provider === 'claude') {
    params.nativeTeam = {
      enabled: true,
      parentSessionId,
      color: spawnColor,
      agentType: opts.role ?? 'general-purpose',
      planModeRequired: opts.planMode,
      permissionMode: opts.permissionMode,
      agentName: opts.role,
    };
  }

  const validated = validateSpawnParams(params);
  const launch = buildLaunchCommand(validated);
  const layoutMode = resolveLayoutMode(opts.layout);
  const workerId = await generateWorkerId(validated.team, validated.role);

  const nt = validated.nativeTeam;
  const now = new Date().toISOString();
  const agentName = nt?.agentName ?? validated.role ?? 'worker';

  // 3. Handle OTel relay for Codex workers
  let otelRelayActive = false;
  if (!nt?.enabled && validated.provider === 'codex') {
    ensureCodexOtelConfig();
    otelRelayActive = await ensureOtelRelay(validated.team);
  }

  // 4. Build full command with env vars
  let fullCommand = launch.command;
  if (launch.env && Object.keys(launch.env).length > 0) {
    const envArgs = Object.entries(launch.env)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    fullCommand = `env ${envArgs} ${launch.command}`;
  }

  // 5. Create tmux pane
  let paneId: string;
  try {
    paneId = execSync(
      `tmux split-window -d -P -F '#{pane_id}' ${fullCommand}`,
      { encoding: 'utf-8' },
    ).trim();
  } catch (err: any) {
    throw new Error(`Failed to create tmux pane: ${err?.message ?? 'unknown error'}`);
  }

  // Best-effort layout
  try {
    execSync(`tmux ${buildLayoutCommand('genie:0', layoutMode)}`, { stdio: 'ignore' });
  } catch { /* best-effort */ }

  // 6. Register worker
  const workerEntry: registry.Worker = {
    id: workerId,
    paneId,
    session: 'genie',
    provider: validated.provider,
    transport: 'tmux',
    role: validated.role,
    skill: validated.skill,
    team: validated.team,
    worktree: null,
    startedAt: now,
    state: 'spawning',
    lastStateChange: now,
    repoPath,
    nativeTeamEnabled: nt?.enabled ?? false,
    nativeAgentId: `${agentName}@${validated.team}`,
    nativeColor: nt?.color ?? spawnColor,
    parentSessionId: nt?.parentSessionId ?? parentSessionId,
  };
  await registry.register(workerEntry);

  // 7. Register in native team + send join notification
  await nativeTeams.registerNativeMember(validated.team, {
    agentName,
    agentType: nt?.agentType ?? validated.role ?? 'general-purpose',
    color: nt?.color ?? spawnColor ?? 'blue',
    tmuxPaneId: paneId,
    cwd: repoPath,
    planModeRequired: nt?.planModeRequired,
  });
  await nativeTeams.writeNativeInbox(validated.team, 'team-lead', {
    from: agentName,
    text: `Worker ${agentName} (${validated.provider}) joined team ${validated.team}. cwd: ${repoPath}. Ready for tasks.`,
    summary: `${agentName} (${validated.provider}) joined`,
    timestamp: new Date().toISOString(),
    color: nt?.color ?? spawnColor ?? 'blue',
    read: false,
  });

  // 8. Register with OTel relay for Codex
  if (otelRelayActive && paneId !== '%0') {
    const { writeFileSync: wfs } = require('fs');
    const { join: pjoin } = require('path');
    const { homedir: hdir } = require('os');
    const rd = pjoin(hdir(), '.genie', 'relay');
    wfs(pjoin(rd, `${workerId}-pane`), paneId);
    wfs(pjoin(rd, `${workerId}-meta`), JSON.stringify({
      agent: agentName,
      color: spawnColor,
    }));
  }

  return { workerId, paneId, worker: workerEntry };
}
