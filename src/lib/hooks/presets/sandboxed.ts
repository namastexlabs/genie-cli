/**
 * Sandboxed Hook Preset
 *
 * Restricts file operations to specific directories.
 * Intercepts PreToolUse events for file-related tools and denies operations
 * outside the allowed paths.
 *
 * Usage:
 *   const hooks = sandboxedHooks({ allowedPaths: ['~/projects', '/tmp'] });
 */

import { resolve, normalize } from 'path';
import { homedir } from 'os';
import type { SandboxedConfig } from '../../../types/genie-config.js';
import type { HookConfig, HookInput, HookOutput } from './collaborative.js';

export interface SandboxedHookConfig {
  allowedPaths: string[];
}

/**
 * Default configuration for sandboxed hooks
 */
export const DEFAULT_SANDBOXED_CONFIG: SandboxedHookConfig = {
  allowedPaths: ['~/projects', '/tmp'],
};

/**
 * Tools that access files
 */
const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

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
 * Normalize and resolve a path, expanding ~
 */
function normalizePath(path: string): string {
  return normalize(resolve(expandTilde(path)));
}

/**
 * Check if a path is within any of the allowed paths
 */
function isWithinAllowed(targetPath: string, allowedPaths: string[]): boolean {
  const normalizedTarget = normalizePath(targetPath);

  for (const allowed of allowedPaths) {
    const normalizedAllowed = normalizePath(allowed);

    // Check if target is within or equal to allowed path
    if (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(normalizedAllowed + '/')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the path from tool input
 */
function extractPath(toolName: string, toolInput: unknown): string | null {
  const input = toolInput as Record<string, unknown>;

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string) || null;
    case 'Glob':
      return (input.path as string) || process.cwd();
    case 'Grep':
      return (input.path as string) || process.cwd();
    default:
      return null;
  }
}

/**
 * Create sandboxed hooks configuration
 *
 * This hook intercepts PreToolUse events for file-related tools and
 * denies operations on paths outside the allowed directories.
 */
export function sandboxedHooks(config: Partial<SandboxedConfig> = {}): HookConfig {
  const allowedPaths = config.allowedPaths || DEFAULT_SANDBOXED_CONFIG.allowedPaths;

  // Create a regex pattern that matches all file tools
  const fileToolPattern = new RegExp(`^(${FILE_TOOLS.join('|')})$`);

  return {
    PreToolUse: [
      {
        matcher: fileToolPattern,
        timeout: 30,
        hooks: [
          async (input: HookInput, _toolUseID, _options): Promise<HookOutput> => {
            // Type guard - only process PreToolUse events
            if (input.hook_event_name !== 'PreToolUse') {
              return { continue: true };
            }

            const toolName = input.tool_name;
            if (!toolName || !FILE_TOOLS.includes(toolName)) {
              return { continue: true };
            }

            const targetPath = extractPath(toolName, input.tool_input);

            // If we can't extract a path, allow the operation
            // (better to be permissive than block valid operations)
            if (!targetPath) {
              return { continue: true };
            }

            // Check if path is within allowed directories
            if (!isWithinAllowed(targetPath, allowedPaths)) {
              const allowedDisplay = allowedPaths.map((p) =>
                p.startsWith('~') ? p : expandTilde(p)
              ).join(', ');

              return {
                continue: false,
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: `Path "${targetPath}" is outside the sandbox. Allowed paths: ${allowedDisplay}`,
                },
              };
            }

            return { continue: true };
          },
        ],
      },
    ],
  };
}
