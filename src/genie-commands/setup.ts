/**
 * Genie Setup Command
 *
 * Interactive wizard for configuring genie hooks and settings.
 * Teaches users about hooks and lets them choose which to enable.
 */

import { checkbox, confirm, input } from '@inquirer/prompts';
import {
  loadGenieConfig,
  saveGenieConfig,
  genieConfigExists,
  getGenieConfigPath,
} from '../lib/genie-config.js';
import {
  GenieConfig,
  PresetName,
  PRESET_DESCRIPTIONS,
} from '../types/genie-config.js';
import { describeEnabledHooks } from '../lib/hooks/index.js';
import { installShortcuts, isShortcutsInstalled } from '../term-commands/shortcuts.js';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Print the header banner
 */
function printHeader(): void {
  console.log();
  console.log('\x1b[1m\x1b[36m' + '╔' + '═'.repeat(62) + '╗' + '\x1b[0m');
  console.log('\x1b[1m\x1b[36m' + '║  ' + '\x1b[0m\x1b[1m🧞 Genie Setup - Configure Your AI Assistant' + ' '.repeat(16) + '\x1b[36m║\x1b[0m');
  console.log('\x1b[1m\x1b[36m' + '╚' + '═'.repeat(62) + '╝' + '\x1b[0m');
  console.log();
}

/**
 * Print the about hooks section
 */
function printAboutHooks(): void {
  console.log('\x1b[1m📚 ABOUT HOOKS\x1b[0m');
  console.log('\x1b[2mHooks let you control how the AI uses tools - without wasting\x1b[0m');
  console.log('\x1b[2mtokens on prompts! Instead of telling the AI "please use term",\x1b[0m');
  console.log('\x1b[2mhooks automatically enforce the behavior.\x1b[0m');
  console.log();
  console.log('\x1b[2m' + '─'.repeat(64) + '\x1b[0m');
  console.log();
}

/**
 * Print available presets in a nice format
 */
function printPresetDescriptions(): void {
  console.log('\x1b[1m🔧 AVAILABLE HOOK PRESETS\x1b[0m');
  console.log();

  for (let i = 0; i < PRESET_DESCRIPTIONS.length; i++) {
    const preset = PRESET_DESCRIPTIONS[i];
    const num = i + 1;
    const recommended = preset.recommended ? ' \x1b[32m(Recommended)\x1b[0m' : '';

    console.log(`\x1b[1m${num}. ${preset.title}\x1b[0m${recommended}`);
    console.log(`   ├─ What: ${preset.what}`);
    console.log(`   ├─ Why:  ${preset.why}`);
    console.log(`   └─ How:  ${preset.how}`);
    console.log();
  }

  console.log('\x1b[2m' + '─'.repeat(64) + '\x1b[0m');
  console.log();
}

/**
 * Format preset choice for checkbox
 */
function formatPresetChoice(preset: typeof PRESET_DESCRIPTIONS[0], enabled: boolean): {
  name: string;
  value: PresetName;
  checked: boolean;
} {
  const recommended = preset.recommended ? ' \x1b[32m(Recommended)\x1b[0m' : '';
  return {
    name: `${preset.title}${recommended} - ${preset.what}`,
    value: preset.name,
    checked: enabled,
  };
}

/**
 * Print success message
 */
function printSuccess(configPath: string): void {
  console.log();
  console.log(`\x1b[32m✓ Configuration saved to ${configPath}\x1b[0m`);
  console.log();
  console.log('\x1b[1m💡 TIP:\x1b[0m Claudio will automatically use these hooks.');
  console.log('   Run: \x1b[36mclaudio launch\x1b[0m');
  console.log('   Watch: \x1b[36mtmux attach -t genie\x1b[0m');
  console.log();
}

/**
 * Print current configuration
 */
function printCurrentConfig(config: GenieConfig): void {
  const descriptions = describeEnabledHooks(config);

  if (descriptions.length === 0) {
    console.log('\x1b[33mNo hooks currently enabled.\x1b[0m');
  } else {
    console.log('\x1b[1mCurrently enabled hooks:\x1b[0m');
    for (const desc of descriptions) {
      console.log(`  • ${desc}`);
    }
  }
  console.log();
}

/**
 * Configure sandboxed preset paths
 */
async function configureSandbox(config: GenieConfig): Promise<void> {
  const currentPaths = config.hooks.sandboxed?.allowedPaths || ['~/projects', '/tmp'];

  console.log('\x1b[1mSandbox Configuration\x1b[0m');
  console.log('\x1b[2mEnter paths where the AI can access files (comma-separated):\x1b[0m');

  const pathsInput = await input({
    message: 'Allowed paths:',
    default: currentPaths.join(', '),
  });

  const allowedPaths = pathsInput
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  config.hooks.sandboxed = { allowedPaths };
}

/**
 * Configure audited preset log path
 */
async function configureAudit(config: GenieConfig): Promise<void> {
  const currentPath = config.hooks.audited?.logPath || '~/.genie/audit.log';

  console.log('\x1b[1mAudit Configuration\x1b[0m');

  const logPath = await input({
    message: 'Audit log path:',
    default: currentPath,
  });

  config.hooks.audited = { logPath };
}

/**
 * Main setup wizard
 */
export async function setupCommand(): Promise<void> {
  printHeader();
  printAboutHooks();
  printPresetDescriptions();

  // Load existing config or defaults
  const config = await loadGenieConfig();
  const existingPresets = new Set(config.hooks.enabled);

  // If config exists, show current state
  if (genieConfigExists()) {
    console.log('\x1b[1m📋 CURRENT CONFIGURATION\x1b[0m');
    printCurrentConfig(config);
  }

  // Build choices for checkbox
  const choices = PRESET_DESCRIPTIONS.map((preset) =>
    formatPresetChoice(preset, existingPresets.has(preset.name))
  );

  // Prompt for preset selection
  const selectedPresets = await checkbox<PresetName>({
    message: 'Select hooks to enable (space to toggle, enter to confirm):',
    choices,
  });

  // Update config with selections
  config.hooks.enabled = selectedPresets;

  // If sandboxed is enabled, configure it
  if (selectedPresets.includes('sandboxed')) {
    console.log();
    await configureSandbox(config);
  }

  // If audited is enabled, optionally configure it
  if (selectedPresets.includes('audited')) {
    console.log();
    const customAudit = await confirm({
      message: 'Customize audit log path?',
      default: false,
    });
    if (customAudit) {
      await configureAudit(config);
    }
  }

  // Save configuration
  await saveGenieConfig(config);

  printSuccess(getGenieConfigPath());

  // Show what was configured
  if (selectedPresets.length > 0) {
    console.log('\x1b[1mEnabled hooks:\x1b[0m');
    const descriptions = describeEnabledHooks(config);
    for (const desc of descriptions) {
      console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
    }
    console.log();
  }

  // Offer to install tmux shortcuts
  await offerShortcutsInstall();
}

/**
 * Offer to install tmux keyboard shortcuts
 */
async function offerShortcutsInstall(): Promise<void> {
  // Check if already installed
  const home = homedir();
  const tmuxConf = join(home, '.tmux.conf');

  if (isShortcutsInstalled(tmuxConf)) {
    console.log('\x1b[2m✓ Tmux shortcuts already installed\x1b[0m');
    console.log();
    return;
  }

  console.log('\x1b[2m' + '─'.repeat(64) + '\x1b[0m');
  console.log();
  console.log('\x1b[1m⌨️  KEYBOARD SHORTCUTS\x1b[0m');
  console.log('\x1b[2mOptional: Install Warp-like tmux shortcuts for quick navigation:\x1b[0m');
  console.log('  • Ctrl+T → New tab (window)');
  console.log('  • Ctrl+S → Vertical split');
  console.log('  • Alt+S  → Horizontal split');
  console.log();

  const installShortcutsChoice = await confirm({
    message: 'Install tmux keyboard shortcuts?',
    default: false,
  });

  if (installShortcutsChoice) {
    console.log();
    await installShortcuts();
  } else {
    console.log();
    console.log('\x1b[2mSkipped. Run \x1b[0m\x1b[36mgenie shortcuts install\x1b[0m\x1b[2m later to add them.\x1b[0m');
    console.log();
  }
}

/**
 * Quick setup with recommended defaults
 */
export async function quickSetupCommand(): Promise<void> {
  console.log('\x1b[1m🧞 Quick Setup - Using recommended defaults\x1b[0m');
  console.log();

  const config = await loadGenieConfig();

  // Enable recommended presets
  config.hooks.enabled = ['collaborative', 'audited'];

  await saveGenieConfig(config);

  console.log('\x1b[32m✓ Enabled:\x1b[0m collaborative, audited');
  console.log();
  console.log('Run \x1b[36mgenie setup\x1b[0m to customize further.');
  console.log();
}

