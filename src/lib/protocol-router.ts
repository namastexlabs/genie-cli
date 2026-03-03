/**
 * Protocol Router — Genie-owned message routing across providers.
 *
 * The protocol router is provider-agnostic (DEC-5). It routes
 * messages between workers regardless of whether they are backed
 * by Claude or Codex. Delivery goes through the mailbox first
 * (DEC-7) and then pushes to the tmux pane when the worker is idle.
 */

import * as mailbox from './mailbox.js';
import * as registry from './worker-registry.js';
import * as nativeTeams from './claude-native-teams.js';
import { executeTmux, capturePaneContent } from './tmux.js';
import { spawnWorker } from './worker-spawner.js';

// ============================================================================
// Types
// ============================================================================

export interface DeliveryResult {
  messageId: string;
  workerId: string;
  delivered: boolean;
  reason?: string;
  /** Whether the worker was auto-spawned to deliver this message. */
  autoSpawned?: boolean;
}

/** Delay (ms) after auto-spawning a worker before attempting delivery. */
const AUTO_SPAWN_INIT_DELAY_MS = 3000;

// ============================================================================
// Auto-Spawn Helpers
// ============================================================================

/**
 * Check if a tmux pane is still alive by attempting a minimal capture.
 */
async function isPaneAlive(paneId: string): Promise<boolean> {
  if (!paneId || paneId === 'inline') return false;
  if (!/^%\d+$/.test(paneId)) return false;
  try {
    await capturePaneContent(paneId, 1);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the target worker is alive, auto-spawning from a template if needed.
 *
 * Returns the live worker and whether it was respawned, or null if
 * auto-spawn is not possible (no template, not in tmux, etc.).
 */
async function ensureWorkerAlive(
  worker: registry.Worker | null,
  recipientId: string,
): Promise<{ worker: registry.Worker; respawned: boolean } | null> {
  // If worker exists and pane is alive, nothing to do
  if (worker && await isPaneAlive(worker.paneId)) {
    return { worker, respawned: false };
  }

  // Not in tmux — can't auto-spawn
  if (!process.env.TMUX) return null;

  // Look up template: try worker's role, then the recipient ID directly
  const templateKey = worker?.role ?? worker?.id ?? recipientId;
  let template = await registry.findTemplate(templateKey);
  if (!template && worker?.role) {
    template = await registry.findTemplate(worker.role);
  }
  if (!template) {
    template = await registry.findTemplate(recipientId);
  }
  if (!template) return null;

  try {
    // Clean up the dead worker entry before respawning
    if (worker) {
      await registry.unregister(worker.id);
    }

    const result = await spawnWorker({
      provider: template.provider,
      team: template.team,
      role: template.role,
      skill: template.skill,
      cwd: template.cwd,
      extraArgs: template.extraArgs,
    });

    // Update template's last-spawned timestamp
    await registry.saveTemplate({
      ...template,
      lastSpawnedAt: new Date().toISOString(),
    });

    // Wait for the worker to initialize
    await new Promise(resolve => setTimeout(resolve, AUTO_SPAWN_INIT_DELAY_MS));

    return { worker: result.worker, respawned: true };
  } catch {
    // Auto-spawn failed — non-fatal, fall through to normal delivery
    return null;
  }
}

// ============================================================================
// Delivery
// ============================================================================

/**
 * Send a message to a worker. The message is persisted to the
 * mailbox BEFORE any delivery attempt.
 *
 * @param repoPath — Repository root path for mailbox storage.
 * @param from — Sender ID ("operator" for human messages).
 * @param to — Recipient worker ID.
 * @param body — Message body text.
 * @returns Delivery result with message ID.
 */
export async function sendMessage(
  repoPath: string,
  from: string,
  to: string,
  body: string,
  teamName?: string,
): Promise<DeliveryResult> {
  // 1. Resolve the target worker (exact match or fuzzy)
  let worker = await registry.get(to);
  let autoSpawned = false;

  if (!worker) {
    // Try finding by fuzzy match (team:role pattern)
    const allWorkers = await registry.list();
    const matches = allWorkers.filter(w =>
      w.id === to || w.role === to || `${w.team}:${w.role}` === to
    );

    if (matches.length > 1) {
      return {
        messageId: '',
        workerId: to,
        delivered: false,
        reason: `Worker "${to}" is ambiguous. Found ${matches.length} matches: ${matches.map(m => m.id).join(', ')}. Please use a unique worker ID.`,
      };
    }

    worker = matches[0] ?? null;
  }

  // 2. Ensure the worker is alive — auto-spawn from template if dead/missing
  const aliveResult = await ensureWorkerAlive(worker, to);
  if (aliveResult) {
    worker = aliveResult.worker;
    autoSpawned = aliveResult.respawned;
  }

  // 3. If still no worker, try native inbox fallback
  if (!worker) {
    const resolvedTeam = teamName ?? await nativeTeams.discoverTeamName();

    // Try auto-spawn via template even when no worker entry existed
    // (ensureWorkerAlive above already tried, but only if worker was null
    // and we had a template — if we reach here, there's no template either)

    if (resolvedTeam) {
      try {
        const message = await mailbox.send(repoPath, from, to, body);
        const nativeMsg: nativeTeams.NativeInboxMessage = {
          from,
          text: body,
          summary: body.length > 50 ? `${body.substring(0, 50)}...` : body,
          timestamp: new Date().toISOString(),
          color: 'blue',
          read: false,
        };
        await nativeTeams.writeNativeInbox(resolvedTeam, to, nativeMsg);
        await mailbox.markDelivered(repoPath, to, message.id);
        return {
          messageId: message.id,
          workerId: to,
          delivered: true,
        };
      } catch {
        // Native inbox write failed — fall through to error
      }
    }

    return {
      messageId: '',
      workerId: to,
      delivered: false,
      reason: `Worker "${to}" not found in registry and no template available for auto-spawn`,
    };
  }

  // 4. Persist to mailbox first (DEC-7)
  const message = await mailbox.send(repoPath, from, worker.id, body);

  // 5. Deliver based on worker type
  let delivered = false;
  if (worker.nativeTeamEnabled && worker.team && worker.role) {
    delivered = await writeToNativeInbox(worker, message);
  } else {
    delivered = await injectToTmuxPane(worker, message);
  }

  if (delivered) {
    await mailbox.markDelivered(repoPath, worker.id, message.id);
  }

  return {
    messageId: message.id,
    workerId: worker.id,
    delivered,
    autoSpawned: autoSpawned || undefined,
  };
}

/**
 * Write a Genie mailbox message to the Claude Code native inbox.
 * Best-effort — failures here don't block the Genie mailbox write.
 */
async function writeToNativeInbox(
  worker: registry.Worker,
  message: mailbox.MailboxMessage,
): Promise<boolean> {
  try {
    const nativeMsg = mailbox.toNativeInboxMessage(
      message,
      worker.nativeColor ?? 'blue',
    );
    const agentName = worker.role ?? worker.id;
    await nativeTeams.writeNativeInbox(worker.team!, agentName, nativeMsg);
    return true;
  } catch {
    // Best-effort — native inbox write failure is non-fatal
    return false;
  }
}

/**
 * Inject a message into a worker's tmux pane via send-keys.
 * Used for non-native workers (e.g., Codex) that don't have
 * Claude Code's inbox polling. Best-effort — failures are non-fatal.
 */
async function injectToTmuxPane(
  worker: registry.Worker,
  message: mailbox.MailboxMessage,
): Promise<boolean> {
  if (!worker.paneId) return false;

  // Validate paneId to prevent shell injection
  if (!/^%\d+$/.test(worker.paneId)) return false;

  try {
    // Escape single quotes for shell embedding
    const escaped = message.body.replace(/'/g, "'\\''");
    // Send text first, then Enter after a short delay so the pane can process the input
    await executeTmux(`send-keys -t '${worker.paneId}' '${escaped}'`);
    await new Promise(resolve => setTimeout(resolve, 200));
    await executeTmux(`send-keys -t '${worker.paneId}' Enter`);
    return true;
  } catch {
    // Best-effort — pane may be dead or busy
    return false;
  }
}

/**
 * Attempt to push pending messages to a worker's tmux pane.
 * Called when a worker transitions to idle state.
 * For non-native workers, injects via tmux send-keys.
 */
export async function flushPending(
  repoPath: string,
  workerId: string,
): Promise<DeliveryResult[]> {
  const messages = await mailbox.pending(repoPath, workerId);
  if (messages.length === 0) return [];

  const worker = await registry.get(workerId);
  const results: DeliveryResult[] = [];

  for (const msg of messages) {
    let delivered = false;

    if (worker) {
      if (worker.nativeTeamEnabled && worker.team && worker.role) {
        delivered = await writeToNativeInbox(worker, msg);
      } else if (worker.paneId) {
        delivered = await injectToTmuxPane(worker, msg);
      }
    }

    if (delivered) {
      await mailbox.markDelivered(repoPath, workerId, msg.id);
    }

    results.push({
      messageId: msg.id,
      workerId,
      delivered,
    });
  }

  return results;
}

/**
 * Get the inbox for a worker (all messages, with read/unread status).
 */
export async function getInbox(
  repoPath: string,
  workerId: string,
): Promise<mailbox.MailboxMessage[]> {
  return mailbox.inbox(repoPath, workerId);
}

/**
 * Get unread message count for a worker.
 */
export async function unreadCount(
  repoPath: string,
  workerId: string,
): Promise<number> {
  const messages = await mailbox.unread(repoPath, workerId);
  return messages.length;
}
