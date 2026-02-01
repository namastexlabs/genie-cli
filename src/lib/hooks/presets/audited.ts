/**
 * Audited Hook Preset
 *
 * Logs all tool executions to a file for later review.
 * Uses PostToolUse hooks to capture tool inputs and outputs.
 *
 * Usage:
 *   const hooks = auditedHooks({ logPath: '~/.genie/audit.log' });
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { homedir } from 'os';
import type { AuditedConfig } from '../../../types/genie-config.js';
import type { HookConfig, HookInput, HookOutput } from './collaborative.js';

export interface AuditedHookConfig {
  logPath: string;
}

/**
 * Default configuration for audited hooks
 */
export const DEFAULT_AUDITED_CONFIG: AuditedHookConfig = {
  logPath: '~/.genie/audit.log',
};

/**
 * Expand ~ to home directory
 */
function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return homedir() + path.slice(1);
  }
  if (path === '~') {
    return homedir();
  }
  return path;
}

/**
 * Format a tool input/output for logging
 * Truncates very long values to avoid log bloat
 */
function formatForLog(value: unknown, maxLength: number = 1000): string {
  try {
    const str = JSON.stringify(value);
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '...[truncated]';
    }
    return str;
  } catch {
    return String(value);
  }
}

/**
 * Audit log entry
 */
interface AuditEntry {
  timestamp: string;
  tool: string;
  input: unknown;
  response?: unknown;
  duration_ms?: number;
}

/**
 * Append an entry to the audit log
 */
function appendToLog(logPath: string, entry: AuditEntry): void {
  const expandedPath = resolve(expandTilde(logPath));
  const dir = dirname(expandedPath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const logLine = JSON.stringify({
    ...entry,
    input: formatForLog(entry.input),
    response: entry.response ? formatForLog(entry.response) : undefined,
  }) + '\n';

  appendFileSync(expandedPath, logLine, 'utf-8');
}

// Track tool start times for duration calculation
const toolStartTimes = new Map<string, number>();

/**
 * Create audited hooks configuration
 *
 * This hook captures all tool executions using PostToolUse hooks and
 * logs them to a file in JSONL format for later review.
 */
export function auditedHooks(config: Partial<AuditedConfig> = {}): HookConfig {
  const logPath = config.logPath || DEFAULT_AUDITED_CONFIG.logPath;

  return {
    PreToolUse: [
      {
        // Match all tools
        matcher: /.*/,
        timeout: 10,
        hooks: [
          async (input: HookInput, toolUseID, _options): Promise<HookOutput> => {
            // Record start time for duration calculation
            if (toolUseID) {
              toolStartTimes.set(toolUseID, Date.now());
            }
            return { continue: true };
          },
        ],
      },
    ],
    PostToolUse: [
      {
        // Match all tools
        matcher: /.*/,
        timeout: 10,
        hooks: [
          async (input: HookInput, toolUseID, _options): Promise<HookOutput> => {
            // Type guard - only process PostToolUse events
            if (input.hook_event_name !== 'PostToolUse') {
              return { continue: true };
            }

            // Calculate duration if we have a start time
            let duration_ms: number | undefined;
            if (toolUseID && toolStartTimes.has(toolUseID)) {
              duration_ms = Date.now() - toolStartTimes.get(toolUseID)!;
              toolStartTimes.delete(toolUseID);
            }

            const entry: AuditEntry = {
              timestamp: new Date().toISOString(),
              tool: input.tool_name || 'unknown',
              input: input.tool_input,
              response: input.tool_response,
              duration_ms,
            };

            try {
              appendToLog(logPath, entry);
            } catch (error) {
              // Don't fail the tool call if logging fails
              console.warn(`Audit log warning: ${error}`);
            }

            return { continue: true };
          },
        ],
      },
    ],
  };
}

/**
 * Read the audit log as an array of entries
 * Useful for analysis and review
 */
export function readAuditLog(logPath: string = DEFAULT_AUDITED_CONFIG.logPath): AuditEntry[] {
  const expandedPath = resolve(expandTilde(logPath));

  if (!existsSync(expandedPath)) {
    return [];
  }

  const { readFileSync } = require('fs');
  const content = readFileSync(expandedPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  return lines.map((line: string) => {
    try {
      return JSON.parse(line);
    } catch {
      return { error: 'parse_failed', raw: line };
    }
  });
}

/**
 * Clear the audit log
 */
export function clearAuditLog(logPath: string = DEFAULT_AUDITED_CONFIG.logPath): void {
  const expandedPath = resolve(expandTilde(logPath));
  const { writeFileSync } = require('fs');
  writeFileSync(expandedPath, '', 'utf-8');
}
