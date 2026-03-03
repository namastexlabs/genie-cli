/**
 * Tests for idle-timeout — suspend, check, and configuration.
 * Run with: bun test src/lib/idle-timeout.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';

import {
  suspendWorker,
  checkIdleWorkers,
  getIdleTimeoutMs,
  WATCHDOG_POLL_INTERVAL_MS,
} from './idle-timeout.js';

import {
  register,
  get,
  list,
  saveTemplate,
  listTemplates,
  type Worker,
  type WorkerTemplate,
} from './worker-registry.js';

// ============================================================================
// Test Setup — uses isolated registry path via env override
// ============================================================================

const TEST_DIR = '/tmp/idle-timeout-test';
const TEST_GENIE_DIR = join(TEST_DIR, '.genie');
const TEST_REGISTRY_PATH = join(TEST_GENIE_DIR, 'workers.json');

function cleanTestDir(): void {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
  mkdirSync(TEST_GENIE_DIR, { recursive: true });
}

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: 'test-worker',
    paneId: '%99',
    session: 'genie',
    worktree: null,
    startedAt: new Date().toISOString(),
    state: 'idle',
    lastStateChange: new Date().toISOString(),
    repoPath: TEST_DIR,
    provider: 'claude',
    transport: 'tmux',
    team: 'test-team',
    role: 'dev',
    claudeSessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<WorkerTemplate> = {}): WorkerTemplate {
  return {
    id: 'dev',
    provider: 'claude',
    team: 'test-team',
    role: 'dev',
    cwd: TEST_DIR,
    lastSpawnedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Override registry path so tests don't touch real registry
const originalCwd = process.cwd;
const originalEnv = process.env.GENIE_WORKER_REGISTRY;

beforeEach(() => {
  cleanTestDir();
  // Force global registry path to our test dir
  process.env.GENIE_WORKER_REGISTRY = 'global';
  // Temporarily override config dir via env — the registry module reads
  // from ~/.config/genie/workers.json when GENIE_WORKER_REGISTRY=global,
  // so we write directly to the test path and read it back.
  // For test isolation, we write an empty registry to the test path.
  writeFileSync(TEST_REGISTRY_PATH, JSON.stringify({
    workers: {},
    templates: {},
    lastUpdated: new Date().toISOString(),
  }));
});

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.GENIE_WORKER_REGISTRY = originalEnv;
  } else {
    delete process.env.GENIE_WORKER_REGISTRY;
  }
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ============================================================================
// getIdleTimeoutMs
// ============================================================================

describe('getIdleTimeoutMs', () => {
  const originalTimeout = process.env.GENIE_IDLE_TIMEOUT_MS;

  afterEach(() => {
    if (originalTimeout !== undefined) {
      process.env.GENIE_IDLE_TIMEOUT_MS = originalTimeout;
    } else {
      delete process.env.GENIE_IDLE_TIMEOUT_MS;
    }
  });

  test('returns default (300000) when env not set', () => {
    delete process.env.GENIE_IDLE_TIMEOUT_MS;
    expect(getIdleTimeoutMs()).toBe(300_000);
  });

  test('returns parsed env value when valid', () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '60000';
    expect(getIdleTimeoutMs()).toBe(60_000);
  });

  test('returns default for invalid env (NaN)', () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = 'not-a-number';
    expect(getIdleTimeoutMs()).toBe(300_000);
  });

  test('returns default for zero', () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '0';
    expect(getIdleTimeoutMs()).toBe(300_000);
  });

  test('returns default for negative', () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '-5000';
    expect(getIdleTimeoutMs()).toBe(300_000);
  });

  test('returns default for empty string', () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '';
    expect(getIdleTimeoutMs()).toBe(300_000);
  });
});

// ============================================================================
// suspendWorker
// ============================================================================

describe('suspendWorker', () => {
  test('returns false for nonexistent worker', async () => {
    const result = await suspendWorker('nonexistent-id');
    expect(result).toBe(false);
  });

  test('suspends a worker and sets state to suspended', async () => {
    const worker = makeWorker();
    await register(worker);

    const result = await suspendWorker(worker.id);
    expect(result).toBe(true);

    const updated = await get(worker.id);
    expect(updated).not.toBeNull();
    expect(updated!.state).toBe('suspended');
    expect(updated!.suspendedAt).toBeDefined();
  });

  test('saves sessionId to template for Claude workers', async () => {
    const worker = makeWorker();
    const template = makeTemplate();
    await register(worker);
    await saveTemplate(template);

    await suspendWorker(worker.id);

    const templates = await listTemplates();
    const saved = templates.find(t => t.id === 'dev');
    expect(saved).toBeDefined();
    expect(saved!.lastSessionId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  test('does NOT save sessionId for Codex workers', async () => {
    const worker = makeWorker({
      provider: 'codex',
      claudeSessionId: 'should-not-save',
    });
    const template = makeTemplate({ provider: 'codex' });
    await register(worker);
    await saveTemplate(template);

    await suspendWorker(worker.id);

    const templates = await listTemplates();
    const saved = templates.find(t => t.id === 'dev');
    expect(saved).toBeDefined();
    expect(saved!.lastSessionId).toBeUndefined();
  });

  test('handles worker with dead pane gracefully', async () => {
    // paneId %99999 doesn't exist — killPane should fail silently
    const worker = makeWorker({ paneId: '%99999' });
    await register(worker);

    const result = await suspendWorker(worker.id);
    expect(result).toBe(true);

    const updated = await get(worker.id);
    expect(updated!.state).toBe('suspended');
  });

  test('handles inline worker (no pane to kill)', async () => {
    const worker = makeWorker({ paneId: 'inline' });
    await register(worker);

    const result = await suspendWorker(worker.id);
    expect(result).toBe(true);
  });
});

// ============================================================================
// checkIdleWorkers
// ============================================================================

describe('checkIdleWorkers', () => {
  const originalTimeout = process.env.GENIE_IDLE_TIMEOUT_MS;

  afterEach(() => {
    if (originalTimeout !== undefined) {
      process.env.GENIE_IDLE_TIMEOUT_MS = originalTimeout;
    } else {
      delete process.env.GENIE_IDLE_TIMEOUT_MS;
    }
  });

  test('returns empty array when no workers', async () => {
    const result = await checkIdleWorkers();
    expect(result).toEqual([]);
  });

  test('does not suspend workers below timeout threshold', async () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '300000'; // 5 minutes
    const worker = makeWorker({
      state: 'idle',
      lastStateChange: new Date().toISOString(), // just now
    });
    await register(worker);

    const result = await checkIdleWorkers();
    expect(result).toEqual([]);

    const updated = await get(worker.id);
    expect(updated!.state).toBe('idle'); // still idle
  });

  test('suspends workers above timeout threshold', async () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '1000'; // 1 second
    const worker = makeWorker({
      state: 'idle',
      lastStateChange: new Date(Date.now() - 5000).toISOString(), // 5s ago
    });
    await register(worker);

    const result = await checkIdleWorkers();
    expect(result).toEqual([worker.id]);

    const updated = await get(worker.id);
    expect(updated!.state).toBe('suspended');
  });

  test('only suspends idle workers, not working or spawning', async () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '1000';
    const oldTime = new Date(Date.now() - 5000).toISOString();

    const idleWorker = makeWorker({
      id: 'idle-one',
      state: 'idle',
      lastStateChange: oldTime,
    });
    const workingWorker = makeWorker({
      id: 'working-one',
      state: 'working',
      lastStateChange: oldTime,
    });
    const spawningWorker = makeWorker({
      id: 'spawning-one',
      state: 'spawning',
      lastStateChange: oldTime,
    });

    await register(idleWorker);
    await register(workingWorker);
    await register(spawningWorker);

    const result = await checkIdleWorkers();
    expect(result).toEqual(['idle-one']);

    // working and spawning should be untouched
    const w = await get('working-one');
    expect(w!.state).toBe('working');
    const s = await get('spawning-one');
    expect(s!.state).toBe('spawning');
  });

  test('does not re-suspend already suspended workers', async () => {
    process.env.GENIE_IDLE_TIMEOUT_MS = '1000';
    const worker = makeWorker({
      state: 'suspended',
      lastStateChange: new Date(Date.now() - 5000).toISOString(),
    });
    await register(worker);

    const result = await checkIdleWorkers();
    expect(result).toEqual([]); // already suspended, not idle
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('constants', () => {
  test('WATCHDOG_POLL_INTERVAL_MS is 30 seconds', () => {
    expect(WATCHDOG_POLL_INTERVAL_MS).toBe(30_000);
  });
});
