/**
 * Worker Registry — Tracks worker state with provider metadata.
 *
 * Stores provider, transport, session, window, paneId, role, and skill
 * metadata for every spawned worker. Registry is persisted to
 * `.genie/workers.json` (repo-local) or `~/.config/genie/workers.json`.
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { ProviderName } from './provider-adapters.js';

// ============================================================================
// Types
// ============================================================================

export type WorkerState =
  | 'spawning'
  | 'working'
  | 'idle'
  | 'permission'
  | 'question'
  | 'done'
  | 'error';

export type TransportType = 'tmux';

export interface Worker {
  /** Unique worker ID. */
  id: string;
  /** tmux pane ID (e.g., "%16"). */
  paneId: string;
  /** tmux session name. */
  session: string;
  /** tmux window name. */
  window?: string;
  /** tmux window ID (e.g., "@4"). */
  windowId?: string;
  /** Provider used to launch this worker. */
  provider: ProviderName;
  /** Transport type (always "tmux" for now). */
  transport: TransportType;
  /** Worker role (e.g., "implementor", "tester"). */
  role?: string;
  /** Skill loaded at spawn (codex workers). */
  skill?: string;
  /** Team this worker belongs to. */
  team: string;
  /** Path to git worktree, null if using shared repo. */
  worktree: string | null;
  /** Beads or local task ID this worker is bound to. */
  taskId?: string;
  /** Task title. */
  taskTitle?: string;
  /** ISO timestamp when worker was started. */
  startedAt: string;
  /** Current worker state. */
  state: WorkerState;
  /** Last state change timestamp. */
  lastStateChange: string;
  /** Repository path where worker operates. */
  repoPath: string;
}

export interface WorkerRegistry {
  workers: Record<string, Worker>;
  lastUpdated: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_DIR = join(homedir(), '.config', 'genie');

function getRegistryFilePath(): string {
  const cwd = process.cwd();
  const repoGenie = join(cwd, '.genie');
  try {
    const { existsSync } = require('fs');
    if (process.env.GENIE_WORKER_REGISTRY === 'global') {
      return join(CONFIG_DIR, 'workers.json');
    }
    if (existsSync(repoGenie)) {
      return join(repoGenie, 'workers.json');
    }
  } catch {
    // ignore
  }
  return join(CONFIG_DIR, 'workers.json');
}

// ============================================================================
// Internal
// ============================================================================

async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
}

async function loadRegistry(registryPath?: string): Promise<WorkerRegistry> {
  try {
    const filePath = registryPath ?? getRegistryFilePath();
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { workers: {}, lastUpdated: new Date().toISOString() };
  }
}

async function saveRegistry(registry: WorkerRegistry, registryPath?: string): Promise<void> {
  const filePath = registryPath ?? getRegistryFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  registry.lastUpdated = new Date().toISOString();
  await writeFile(filePath, JSON.stringify(registry, null, 2));
}

// ============================================================================
// Public API
// ============================================================================

/** Register a new worker. */
export async function register(worker: Worker): Promise<void> {
  const registry = await loadRegistry();
  registry.workers[worker.id] = worker;
  await saveRegistry(registry);
}

/** Unregister (remove) a worker. */
export async function unregister(id: string): Promise<void> {
  const registry = await loadRegistry();
  delete registry.workers[id];
  await saveRegistry(registry);
}

/** Get a worker by ID. */
export async function get(id: string): Promise<Worker | null> {
  const registry = await loadRegistry();
  return registry.workers[id] ?? null;
}

/** List all workers. */
export async function list(): Promise<Worker[]> {
  const registry = await loadRegistry();
  return Object.values(registry.workers);
}

/** Update a worker's state. */
export async function updateState(id: string, state: WorkerState): Promise<void> {
  const registry = await loadRegistry();
  const worker = registry.workers[id];
  if (worker) {
    worker.state = state;
    worker.lastStateChange = new Date().toISOString();
    await saveRegistry(registry);
  }
}

/** Update multiple worker fields. */
export async function update(id: string, updates: Partial<Worker>): Promise<void> {
  const registry = await loadRegistry();
  const worker = registry.workers[id];
  if (worker) {
    Object.assign(worker, updates);
    if (updates.state) {
      worker.lastStateChange = new Date().toISOString();
    }
    await saveRegistry(registry);
  }
}

/** Find worker by tmux pane ID. */
export async function findByPane(paneId: string): Promise<Worker | null> {
  const workers = await list();
  const normalized = paneId.startsWith('%') ? paneId : `%${paneId}`;
  return workers.find(w => w.paneId === normalized) ?? null;
}

/** Find workers by team name. */
export async function findByTeam(team: string): Promise<Worker[]> {
  const workers = await list();
  return workers.filter(w => w.team === team);
}

/** Find workers by provider. */
export async function findByProvider(provider: ProviderName): Promise<Worker[]> {
  const workers = await list();
  return workers.filter(w => w.provider === provider);
}

/** Get workers in a specific state. */
export async function getByState(state: WorkerState): Promise<Worker[]> {
  const workers = await list();
  return workers.filter(w => w.state === state);
}

/** Calculate elapsed time for a worker. */
export function getElapsedTime(worker: Worker): { ms: number; formatted: string } {
  const startTime = new Date(worker.startedAt).getTime();
  const ms = Date.now() - startTime;
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  let formatted: string;
  if (hours > 0) {
    formatted = `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    formatted = `${minutes}m`;
  } else {
    formatted = '<1m';
  }

  return { ms, formatted };
}

/** Get the config directory path. */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/** Get the registry file path. */
export function getRegistryPath(): string {
  return getRegistryFilePath();
}
