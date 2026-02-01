/**
 * Supervised Hook Preset
 *
 * Requires explicit approval for file modifications.
 * Intercepts PermissionRequest events and forces 'ask' behavior for Write/Edit tools.
 *
 * Usage:
 *   const hooks = supervisedHooks({ alwaysAsk: ['Write', 'Edit'] });
 */

import type { SupervisedConfig } from '../../../types/genie-config.js';
import type { HookConfig, HookInput, HookOutput } from './collaborative.js';

export interface SupervisedHookConfig {
  alwaysAsk: string[];
}

/**
 * Default configuration for supervised hooks
 */
export const DEFAULT_SUPERVISED_CONFIG: SupervisedHookConfig = {
  alwaysAsk: ['Write', 'Edit'],
};

/**
 * Create supervised hooks configuration
 *
 * This hook intercepts PermissionRequest events and ensures that
 * specified tools (default: Write, Edit) always require user approval.
 */
export function supervisedHooks(config: Partial<SupervisedConfig> = {}): HookConfig {
  const alwaysAsk = config.alwaysAsk || DEFAULT_SUPERVISED_CONFIG.alwaysAsk;
  const alwaysAskSet = new Set(alwaysAsk);

  return {
    PermissionRequest: [
      {
        timeout: 30,
        hooks: [
          async (input: HookInput, _toolUseID, _options): Promise<HookOutput> => {
            // Type guard - only process PermissionRequest events
            if (input.hook_event_name !== 'PermissionRequest') {
              return { continue: true };
            }

            const toolName = input.tool_name;

            // Check if this tool requires approval
            if (toolName && alwaysAskSet.has(toolName)) {
              return {
                continue: true,
                hookSpecificOutput: {
                  hookEventName: 'PermissionRequest',
                  decision: { behavior: 'ask' },
                },
              };
            }

            // Allow other tools to proceed normally
            return { continue: true };
          },
        ],
      },
    ],
  };
}
