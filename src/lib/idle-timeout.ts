/**
 * Idle Timeout — Suspends workers that have been idle too long.
 *
 * When a worker stays in 'idle' state beyond GENIE_IDLE_TIMEOUT_MS
 * (default 5 minutes), the watchdog kills its tmux pane and sets
 * state to 'suspended'. The session ID is preserved in the worker
 * template so the protocol router can auto-spawn with --resume
 * when the next message arrives.
 *
 * The watchdog runs as a persistent tmux pane (spawned via
 * `genie watchdog start`), not as an inline setInterval. CLI
 * commands are ephemeral — a setInterval would die with the process.
 */

import * as registry from './worker-registry.js';
import { killPane } from './tmux.js';

// ============================================================================
// Configuration
// ============================================================================

/** Default idle timeout: 5 minutes. */
const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

/** Polling interval for the watchdog loop (ms). */
export const WATCHDOG_POLL_INTERVAL_MS = 30_000;

/** Read idle timeout from env or use default. */
export function getIdleTimeoutMs(): number {
  const envVal = process.env.GENIE_IDLE_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_IDLE_TIMEOUT_MS;
}

// ============================================================================
// Suspend
// ============================================================================

/**
 * Suspend a single worker: kill pane, save session ID to template,
 * set state to 'suspended'. The worker stays in the registry so
 * the protocol router can find it and auto-spawn with --resume.
 *
 * Only preserves session ID for Claude workers (Codex doesn't
 * support --resume).
 */
export async function suspendWorker(workerId: string): Promise<boolean> {
  const worker = await registry.get(workerId);
  if (!worker) return false;

  // Save session ID to template before killing pane (Claude only)
  if (worker.claudeSessionId && worker.provider === 'claude') {
    const templates = await registry.listTemplates();
    const candidates = [worker.role, worker.id].filter((v): v is string => Boolean(v));
    const template = templates.find(t =>
      candidates.some(q => t.id === q || t.role === q)
    );
    if (template) {
      await registry.saveTemplate({
        ...template,
        lastSessionId: worker.claudeSessionId,
      });
    }
  }

  // Kill the tmux pane (best-effort)
  if (worker.paneId && worker.paneId !== 'inline') {
    try { await killPane(worker.paneId); } catch { /* pane may already be gone */ }
  }

  // Update worker state to suspended (keep in registry)
  await registry.update(workerId, {
    state: 'suspended',
    suspendedAt: new Date().toISOString(),
  });

  return true;
}

// ============================================================================
// Check
// ============================================================================

/**
 * Check all idle workers and suspend those that have exceeded the timeout.
 * Returns the IDs of workers that were suspended.
 */
export async function checkIdleWorkers(): Promise<string[]> {
  const timeoutMs = getIdleTimeoutMs();
  const workers = await registry.list();
  const suspended: string[] = [];

  for (const w of workers) {
    if (w.state !== 'idle') continue;

    const idleSince = new Date(w.lastStateChange).getTime();
    const idleDuration = Date.now() - idleSince;

    if (idleDuration >= timeoutMs) {
      const ok = await suspendWorker(w.id);
      if (ok) suspended.push(w.id);
    }
  }

  return suspended;
}

// ============================================================================
// Watchdog Loop (runs in a persistent tmux pane)
// ============================================================================

/**
 * Run the watchdog loop. This blocks the process and checks idle
 * workers every WATCHDOG_POLL_INTERVAL_MS. Designed to be called
 * from a dedicated tmux pane spawned by `genie watchdog start`.
 *
 * Exits naturally when no workers remain in the registry.
 */
export async function runWatchdogLoop(): Promise<void> {
  const intervalMs = WATCHDOG_POLL_INTERVAL_MS;
  const timeoutMs = getIdleTimeoutMs();
  console.log(`[watchdog] Started. Poll interval: ${intervalMs / 1000}s, idle timeout: ${timeoutMs / 1000}s`);

  while (true) {
    try {
      const suspended = await checkIdleWorkers();
      if (suspended.length > 0) {
        console.log(`[watchdog] Suspended ${suspended.length} idle worker(s): ${suspended.join(', ')}`);
      }

      // Exit if no workers left to monitor
      const workers = await registry.list();
      const active = workers.filter(w => w.state !== 'suspended' && w.state !== 'done' && w.state !== 'error');
      if (active.length === 0) {
        console.log('[watchdog] No active workers remaining. Exiting.');
        break;
      }
    } catch (err: any) {
      console.error(`[watchdog] Error: ${err?.message ?? 'unknown'}`);
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }
}
