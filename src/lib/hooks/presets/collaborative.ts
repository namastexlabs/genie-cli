/**
 * Collaborative Hook Preset
 *
 * Makes all terminal operations human-observable via tmux.
 * Intercepts Bash tool calls and rewrites them to go through `term exec`.
 *
 * Usage:
 *   const hooks = collaborativeHooks({ sessionName: 'genie', windowName: 'shell' });
 */

import type { CollaborativeConfig } from '../../../types/genie-config.js';
import { escapeForSingleQuotes } from '../utils/escape.js';

export interface CollaborativeHookConfig {
  sessionName: string;
  windowName: string;
}

/**
 * Default configuration for collaborative hooks
 */
export const DEFAULT_COLLABORATIVE_CONFIG: CollaborativeHookConfig = {
  sessionName: 'genie',
  windowName: 'shell',
};

/**
 * Create collaborative hooks configuration
 *
 * This hook intercepts all Bash tool calls and rewrites them to execute
 * through `term exec <session>:<window> '<command>'`, making all terminal
 * operations visible in a tmux session that humans can attach to.
 */
export function collaborativeHooks(config: Partial<CollaborativeConfig> = {}): HookConfig {
  const sessionName = config.sessionName || DEFAULT_COLLABORATIVE_CONFIG.sessionName;
  const windowName = config.windowName || DEFAULT_COLLABORATIVE_CONFIG.windowName;
  const target = `${sessionName}:${windowName}`;

  return {
    PreToolUse: [
      {
        matcher: 'Bash',
        timeout: 30,
        hooks: [
          async (input, _toolUseID, _options) => {
            // Type guard - only process PreToolUse events
            if (input.hook_event_name !== 'PreToolUse') {
              return { continue: true };
            }

            // Only intercept Bash tool
            if (input.tool_name !== 'Bash') {
              return { continue: true };
            }

            const bashInput = input.tool_input as {
              command: string;
              timeout?: number;
              description?: string;
              run_in_background?: boolean;
            };

            // Rewrite the command to go through term exec
            const termCommand = `term exec ${target} '${escapeForSingleQuotes(bashInput.command)}'`;

            // Create a brief description for the proxied command
            const originalDesc = bashInput.description || bashInput.command.slice(0, 50);
            const proxyDescription = `[term] ${originalDesc}${bashInput.command.length > 50 ? '...' : ''}`;

            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                updatedInput: {
                  command: termCommand,
                  timeout: bashInput.timeout,
                  description: proxyDescription,
                  run_in_background: bashInput.run_in_background,
                },
                permissionDecision: 'allow',
                additionalContext: `Human can observe: tmux attach -t ${sessionName}`,
              },
            };
          },
        ],
      },
    ],
  };
}

/**
 * HookConfig type matching the Claude Agent SDK hook configuration
 */
export interface HookConfig {
  PreToolUse?: Array<{
    matcher: string | RegExp;
    timeout?: number;
    hooks: Array<HookCallback>;
  }>;
  PostToolUse?: Array<{
    matcher?: string | RegExp;
    timeout?: number;
    hooks: Array<HookCallback>;
  }>;
  PermissionRequest?: Array<{
    timeout?: number;
    hooks: Array<HookCallback>;
  }>;
}

/**
 * Hook input types
 */
export interface HookInput {
  hook_event_name: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
}

/**
 * Hook callback type
 */
export type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookOutput>;

/**
 * Hook output type
 */
export interface HookOutput {
  continue: boolean;
  hookSpecificOutput?: {
    hookEventName: string;
    updatedInput?: unknown;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    additionalContext?: string;
    decision?: { behavior: 'allow' | 'deny' | 'ask' };
  };
}
