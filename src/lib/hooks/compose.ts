/**
 * Hook Composition Utilities
 *
 * Functions for merging multiple hook configurations together.
 */

import type { HookConfig } from './presets/collaborative.js';

/**
 * Deep merge two hook configurations
 *
 * Hooks are composed by concatenating their hook arrays.
 * This means all hooks from both configs will run in order.
 */
export function mergeHooks(base: HookConfig, override: HookConfig): HookConfig {
  const result: HookConfig = { ...base };

  // Merge PreToolUse hooks
  if (override.PreToolUse) {
    result.PreToolUse = [...(base.PreToolUse || []), ...override.PreToolUse];
  }

  // Merge PostToolUse hooks
  if (override.PostToolUse) {
    result.PostToolUse = [...(base.PostToolUse || []), ...override.PostToolUse];
  }

  // Merge PermissionRequest hooks
  if (override.PermissionRequest) {
    result.PermissionRequest = [...(base.PermissionRequest || []), ...override.PermissionRequest];
  }

  return result;
}

/**
 * Compose multiple hook configurations into one
 *
 * Hooks are executed in the order they appear in the array.
 * First preset's hooks run first.
 */
export function composeHooks(...configs: HookConfig[]): HookConfig {
  return configs.reduce((acc, config) => mergeHooks(acc, config), {});
}

/**
 * Check if a hook config is empty (no hooks defined)
 */
export function isEmptyHookConfig(config: HookConfig): boolean {
  return (
    (!config.PreToolUse || config.PreToolUse.length === 0) &&
    (!config.PostToolUse || config.PostToolUse.length === 0) &&
    (!config.PermissionRequest || config.PermissionRequest.length === 0)
  );
}

/**
 * Count total number of hooks in a config
 */
export function countHooks(config: HookConfig): number {
  let count = 0;
  if (config.PreToolUse) {
    count += config.PreToolUse.reduce((sum, entry) => sum + entry.hooks.length, 0);
  }
  if (config.PostToolUse) {
    count += config.PostToolUse.reduce((sum, entry) => sum + entry.hooks.length, 0);
  }
  if (config.PermissionRequest) {
    count += config.PermissionRequest.reduce((sum, entry) => sum + entry.hooks.length, 0);
  }
  return count;
}
