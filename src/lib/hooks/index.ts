/**
 * Hook Preset Library
 *
 * Provides reusable hook configurations that can be composed
 * to enforce agent behaviors architecturally (without prompting).
 *
 * Usage:
 *   import { loadHooksFromConfig, presets, composeHooks } from './hooks';
 *
 *   // Load hooks based on genie config
 *   const hooks = await loadHooksFromConfig();
 *
 *   // Or compose manually
 *   const hooks = composeHooks(
 *     presets.collaborative(),
 *     presets.audited({ logPath: '~/.genie/audit.log' })
 *   );
 */

import { loadGenieConfig } from '../genie-config.js';
import type {
  GenieConfig,
  PresetName,
  CollaborativeConfig,
  SupervisedConfig,
  SandboxedConfig,
  AuditedConfig,
} from '../../types/genie-config.js';

// Re-export types
export type { HookConfig, HookCallback, HookInput, HookOutput } from './presets/collaborative.js';

// Re-export utilities
export { mergeHooks, composeHooks, isEmptyHookConfig, countHooks } from './compose.js';
export { escapeForSingleQuotes, escapeForDoubleQuotes, singleQuote, doubleQuote } from './utils/escape.js';

// Import presets
import { collaborativeHooks, type CollaborativeHookConfig } from './presets/collaborative.js';
import { supervisedHooks, type SupervisedHookConfig } from './presets/supervised.js';
import { sandboxedHooks, type SandboxedHookConfig } from './presets/sandboxed.js';
import { auditedHooks, type AuditedHookConfig } from './presets/audited.js';

// Re-export preset types
export type { CollaborativeHookConfig } from './presets/collaborative.js';
export type { SupervisedHookConfig } from './presets/supervised.js';
export type { SandboxedHookConfig } from './presets/sandboxed.js';
export type { AuditedHookConfig } from './presets/audited.js';

// Import compose utilities
import { composeHooks } from './compose.js';
import type { HookConfig } from './presets/collaborative.js';

/**
 * All available presets as functions
 */
export const presets = {
  collaborative: collaborativeHooks,
  supervised: supervisedHooks,
  sandboxed: sandboxedHooks,
  audited: auditedHooks,
} as const;

/**
 * Preset factory type
 */
export type PresetFactory = typeof presets[PresetName];

/**
 * Load hooks from genie config file
 *
 * Reads ~/.genie/config.json and builds a combined hook configuration
 * from all enabled presets.
 *
 * @returns Combined hook configuration from all enabled presets
 */
export async function loadHooksFromConfig(): Promise<HookConfig> {
  const config = await loadGenieConfig();
  return buildHooksFromConfig(config);
}

/**
 * Build hooks from a genie config object
 *
 * This is useful for testing or when you already have the config loaded.
 */
export function buildHooksFromConfig(config: GenieConfig): HookConfig {
  const enabledPresets = config.hooks.enabled;

  if (enabledPresets.length === 0) {
    return {};
  }

  const hookConfigs: HookConfig[] = [];

  for (const presetName of enabledPresets) {
    const presetConfig = config.hooks[presetName] || {};
    const presetFactory = presets[presetName];

    if (presetFactory) {
      hookConfigs.push(presetFactory(presetConfig as any));
    }
  }

  return composeHooks(...hookConfigs);
}

/**
 * Get a human-readable description of the enabled hooks
 */
export function describeEnabledHooks(config: GenieConfig): string[] {
  const descriptions: string[] = [];

  for (const presetName of config.hooks.enabled) {
    switch (presetName) {
      case 'collaborative': {
        const collabConfig: Partial<CollaborativeConfig> = config.hooks.collaborative || {};
        const session = collabConfig.sessionName || 'genie';
        const window = collabConfig.windowName || 'shell';
        descriptions.push(`Collaborative: Bash → term exec ${session}:${window}`);
        break;
      }
      case 'supervised': {
        const supervisedConfig: Partial<SupervisedConfig> = config.hooks.supervised || {};
        const tools = supervisedConfig.alwaysAsk || ['Write', 'Edit'];
        descriptions.push(`Supervised: ${tools.join(', ')} require approval`);
        break;
      }
      case 'sandboxed': {
        const sandboxConfig: Partial<SandboxedConfig> = config.hooks.sandboxed || {};
        const paths = sandboxConfig.allowedPaths || ['~/projects', '/tmp'];
        descriptions.push(`Sandboxed: Restricted to ${paths.join(', ')}`);
        break;
      }
      case 'audited': {
        const auditConfig: Partial<AuditedConfig> = config.hooks.audited || {};
        const logPath = auditConfig.logPath || '~/.genie/audit.log';
        descriptions.push(`Audited: Logging to ${logPath}`);
        break;
      }
    }
  }

  return descriptions;
}

/**
 * Check if any hooks are enabled
 */
export function hasEnabledHooks(config: GenieConfig): boolean {
  return config.hooks.enabled.length > 0;
}

/**
 * Parse hook names from a comma-separated string
 */
export function parseHookNames(input: string): PresetName[] {
  const validPresets: PresetName[] = ['collaborative', 'supervised', 'sandboxed', 'audited'];
  const names = input.split(',').map((s) => s.trim().toLowerCase());

  return names.filter((name): name is PresetName =>
    validPresets.includes(name as PresetName)
  );
}
