/**
 * Worker Namespace — spawn, list, kill, dashboard, shutdown.
 *
 * Commands:
 *   genie worker spawn [--provider <claude|codex>] [--team <t>] [--role <r>] [--skill <s>]
 *   genie worker list
 *   genie worker kill <id>
 *   genie worker dashboard
 */

import { Command } from 'commander';
import { buildLaunchCommand, validateSpawnParams, type ProviderName, type SpawnParams } from '../lib/provider-adapters.js';
import { resolveLayoutMode, buildLayoutCommand } from '../lib/mosaic-layout.js';
import * as registry from '../lib/worker-registry.js';

// ============================================================================
// Helper: Generate Worker ID
// ============================================================================

async function generateWorkerId(team: string, role?: string): Promise<string> {
  const base = role ? `${team}-${role}` : team;
  const existing = await registry.list();
  if (!existing.some(w => w.id === base)) return base;

  let suffix = 2;
  while (existing.some(w => w.id === `${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

// ============================================================================
// Register namespace
// ============================================================================

export function registerWorkerNamespace(program: Command): void {
  const worker = program
    .command('worker')
    .description('Worker lifecycle (spawn, list, kill, dashboard)');

  // worker spawn
  worker
    .command('spawn')
    .description('Spawn a new worker with provider selection')
    .requiredOption('--provider <provider>', 'Provider: claude or codex')
    .requiredOption('--team <team>', 'Team name')
    .option('--role <role>', 'Worker role (e.g., implementor, tester)')
    .option('--skill <skill>', 'Skill to load (required for codex)')
    .option('--layout <layout>', 'Layout mode: mosaic (default) or vertical')
    .option('--extra-args <args...>', 'Extra CLI args forwarded to provider')
    .action(async (options: {
      provider: string;
      team: string;
      role?: string;
      skill?: string;
      layout?: string;
      extraArgs?: string[];
    }) => {
      try {
        // 1. Validate spawn parameters (Group A contract)
        const params: SpawnParams = {
          provider: options.provider as ProviderName,
          team: options.team,
          role: options.role,
          skill: options.skill,
          extraArgs: options.extraArgs,
        };

        const validated = validateSpawnParams(params);

        // 2. Build launch command (Group C adapters)
        const launch = buildLaunchCommand(validated);

        // 3. Resolve layout (Group D)
        const layoutMode = resolveLayoutMode(options.layout);

        // 4. Generate worker ID
        const workerId = await generateWorkerId(validated.team, validated.role);

        // 5. Register worker (Group D — would normally create tmux pane here)
        const now = new Date().toISOString();
        const workerEntry: registry.Worker = {
          id: workerId,
          paneId: '%0', // placeholder — real paneId comes from tmux split
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
          repoPath: process.cwd(),
        };

        await registry.register(workerEntry);

        // 6. Output result
        console.log(`Worker "${workerId}" spawned.`);
        console.log(`  Provider: ${launch.provider}`);
        console.log(`  Command:  ${launch.command}`);
        console.log(`  Team:     ${validated.team}`);
        if (validated.role) console.log(`  Role:     ${validated.role}`);
        if (validated.skill) console.log(`  Skill:    ${validated.skill}`);
        console.log(`  Layout:   ${layoutMode}`);

        // In a full implementation, we would:
        // a) Create/find the tmux session
        // b) Split a new pane with the launch command
        // c) Apply the layout via buildLayoutCommand()
        // d) Update the registry with the real paneId

        console.log('');
        console.log(`Layout command: tmux ${buildLayoutCommand('genie:0', layoutMode)}`);

      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // worker list
  worker
    .command('list')
    .alias('ls')
    .description('List all workers with provider metadata')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const workers = await registry.list();

        if (options.json) {
          console.log(JSON.stringify(workers.map(w => ({
            id: w.id,
            provider: w.provider,
            transport: w.transport,
            session: w.session,
            window: w.window,
            paneId: w.paneId,
            role: w.role,
            skill: w.skill,
            team: w.team,
            state: w.state,
            elapsed: registry.getElapsedTime(w).formatted,
          })), null, 2));
          return;
        }

        if (workers.length === 0) {
          console.log('No workers found.');
          console.log('  Spawn one: genie worker spawn --provider claude --team work --role implementor');
          return;
        }

        console.log('');
        console.log('WORKERS');
        console.log('-'.repeat(80));
        console.log(
          'ID'.padEnd(20) +
          'PROVIDER'.padEnd(10) +
          'TEAM'.padEnd(10) +
          'ROLE'.padEnd(14) +
          'STATE'.padEnd(12) +
          'TIME'
        );
        console.log('-'.repeat(80));

        for (const w of workers) {
          const id = w.id.padEnd(20).substring(0, 20);
          const provider = w.provider.padEnd(10);
          const team = w.team.padEnd(10).substring(0, 10);
          const role = (w.role || '-').padEnd(14).substring(0, 14);
          const state = w.state.padEnd(12);
          const time = registry.getElapsedTime(w).formatted;
          console.log(`${id}${provider}${team}${role}${state}${time}`);
        }
        console.log('');
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // worker kill
  worker
    .command('kill <id>')
    .description('Force kill a worker')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (id: string, options: { yes?: boolean }) => {
      try {
        const w = await registry.get(id);
        if (!w) {
          console.error(`Worker "${id}" not found.`);
          process.exit(1);
        }

        // In full implementation: kill tmux pane, cleanup
        await registry.unregister(id);
        console.log(`Worker "${id}" killed and unregistered.`);
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // worker dashboard
  worker
    .command('dashboard')
    .description('Live status of all workers with provider metadata')
    .option('--json', 'Output as JSON')
    .option('-w, --watch', 'Auto-refresh every 2 seconds')
    .action(async (options: { json?: boolean; watch?: boolean }) => {
      try {
        const workers = await registry.list();

        if (options.json) {
          const summary = {
            total: workers.length,
            byProvider: {
              claude: workers.filter(w => w.provider === 'claude').length,
              codex: workers.filter(w => w.provider === 'codex').length,
            },
            byState: {
              spawning: workers.filter(w => w.state === 'spawning').length,
              working: workers.filter(w => w.state === 'working').length,
              idle: workers.filter(w => w.state === 'idle').length,
              done: workers.filter(w => w.state === 'done').length,
            },
          };
          console.log(JSON.stringify({ summary, workers: workers.map(w => ({
            id: w.id,
            provider: w.provider,
            team: w.team,
            role: w.role,
            skill: w.skill,
            state: w.state,
            paneId: w.paneId,
            transport: w.transport,
          })) }, null, 2));
          return;
        }

        console.log('');
        console.log('WORKER DASHBOARD');
        console.log('='.repeat(80));
        console.log(`Workers: ${workers.length}`);
        console.log(`  Claude: ${workers.filter(w => w.provider === 'claude').length}`);
        console.log(`  Codex:  ${workers.filter(w => w.provider === 'codex').length}`);
        console.log('');

        if (workers.length === 0) {
          console.log('No active workers.');
          return;
        }

        for (const w of workers) {
          const elapsed = registry.getElapsedTime(w).formatted;
          console.log(`  [${w.provider}] ${w.id} (${w.team}/${w.role || 'default'}) — ${w.state} — ${elapsed}`);
          if (w.skill) console.log(`    Skill: ${w.skill}`);
          console.log(`    Pane: ${w.paneId} | Session: ${w.session} | Transport: ${w.transport}`);
        }

        console.log('');

        if (options.watch) {
          console.log('Watch mode: would auto-refresh every 2s (tmux required)');
        }
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });
}
