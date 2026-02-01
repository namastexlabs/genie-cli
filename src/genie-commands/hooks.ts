/**
 * Genie Hooks Commands
 *
 * Commands to install, uninstall, and test hooks in Claude Code.
 * Bridges the gap between genie config and Claude Code settings.
 */

import {
  loadClaudeSettings,
  saveClaudeSettings,
  isGenieHookInstalled,
  addGenieHook,
  removeGenieHook,
  getClaudeSettingsPath,
  contractClaudePath,
} from '../lib/claude-settings.js';
import {
  hookScriptExists,
  writeHookScript,
  removeHookScript,
  testHookScript,
  getHookScriptDisplayPath,
} from '../lib/hook-script.js';
import {
  loadGenieConfig,
  getGenieConfigPath,
} from '../lib/genie-config.js';
import { describeEnabledHooks, hasEnabledHooks } from '../lib/hooks/index.js';
import { checkCommand } from '../lib/system-detect.js';

/**
 * Print a boxed success message
 */
function printSuccessBox(lines: string[]): void {
  const maxLen = Math.max(...lines.map((l) => l.length));
  const width = maxLen + 4;

  console.log();
  console.log('\x1b[32m' + '+' + '-'.repeat(width) + '+' + '\x1b[0m');
  for (const line of lines) {
    const padding = ' '.repeat(maxLen - line.length);
    console.log('\x1b[32m' + '|  ' + '\x1b[0m' + line + padding + '\x1b[32m  |' + '\x1b[0m');
  }
  console.log('\x1b[32m' + '+' + '-'.repeat(width) + '+' + '\x1b[0m');
  console.log();
}

/**
 * Check required dependencies
 */
async function checkDependencies(): Promise<{
  jq: boolean;
  tmux: boolean;
  term: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  const jqCheck = await checkCommand('jq');
  const tmuxCheck = await checkCommand('tmux');
  const termCheck = await checkCommand('term');

  if (!jqCheck.exists) {
    errors.push('jq is required but not installed. Install with: brew install jq (or apt install jq)');
  }

  return {
    jq: jqCheck.exists,
    tmux: tmuxCheck.exists,
    term: termCheck.exists,
    errors,
  };
}

/**
 * Install hooks into Claude Code
 */
export async function installHooksCommand(options: { force?: boolean } = {}): Promise<void> {
  console.log();
  console.log('\x1b[1m Installing Genie Hooks\x1b[0m');
  console.log();

  // Step 1: Check dependencies
  console.log('\x1b[2mChecking dependencies...\x1b[0m');
  const deps = await checkDependencies();

  if (deps.jq) {
    console.log('  \x1b[32m+\x1b[0m jq');
  } else {
    console.log('  \x1b[31m-\x1b[0m jq (required)');
  }

  if (deps.tmux) {
    console.log('  \x1b[32m+\x1b[0m tmux');
  } else {
    console.log('  \x1b[33m-\x1b[0m tmux (recommended for collaborative mode)');
  }

  if (deps.term) {
    console.log('  \x1b[32m+\x1b[0m term');
  } else {
    console.log('  \x1b[33m-\x1b[0m term (required for collaborative mode)');
  }

  if (deps.errors.length > 0) {
    console.log();
    for (const error of deps.errors) {
      console.log('\x1b[31mError:\x1b[0m ' + error);
    }
    process.exit(1);
  }

  console.log();

  // Step 2: Load genie config and check presets
  console.log('\x1b[2mLoading configuration...\x1b[0m');
  const config = await loadGenieConfig();

  if (!hasEnabledHooks(config)) {
    console.log();
    console.log('\x1b[33mNo hook presets are enabled.\x1b[0m');
    console.log('Run \x1b[36mgenie setup\x1b[0m to configure hook presets first.');
    console.log();
    process.exit(1);
  }

  const descriptions = describeEnabledHooks(config);
  console.log('  \x1b[32m+\x1b[0m Enabled presets: ' + config.hooks.enabled.join(', '));
  console.log();

  // Step 3: Check if collaborative preset needs tmux
  if (config.hooks.enabled.includes('collaborative')) {
    if (!deps.tmux) {
      console.log('\x1b[33mWarning:\x1b[0m Collaborative mode enabled but tmux not found.');
      console.log('Install tmux for the best experience: brew install tmux (or apt install tmux)');
      console.log();
    }
    if (!deps.term) {
      console.log('\x1b[33mWarning:\x1b[0m Collaborative mode enabled but term not found.');
      console.log('The term command is required for collaborative mode to work.');
      console.log();
    }
  }

  // Step 4: Check if already installed
  const settings = await loadClaudeSettings();
  if (isGenieHookInstalled(settings) && !options.force) {
    console.log('\x1b[33mGenie hooks are already installed.\x1b[0m');
    console.log('Use \x1b[36m--force\x1b[0m to reinstall.');
    console.log();
    return;
  }

  // Step 5: Write the hook script
  console.log('\x1b[2mWriting hook script...\x1b[0m');
  await writeHookScript();
  console.log('  \x1b[32m+\x1b[0m ' + getHookScriptDisplayPath());
  console.log();

  // Step 6: Update Claude settings
  console.log('\x1b[2mUpdating Claude Code settings...\x1b[0m');
  const updatedSettings = addGenieHook(settings);
  await saveClaudeSettings(updatedSettings);
  console.log('  \x1b[32m+\x1b[0m Hook registered in ' + contractClaudePath(getClaudeSettingsPath()));
  console.log();

  // Step 7: Print success
  const sessionName = config.hooks.collaborative?.sessionName || 'genie';
  printSuccessBox([
    '\x1b[32m+\x1b[0m Installation complete!',
    '',
    'Restart Claude Code for changes to take effect.',
    '',
    'After restart, all Bash commands will run in tmux.',
    `Watch with: tmux attach -t ${sessionName}`,
  ]);
}

/**
 * Uninstall hooks from Claude Code
 */
export async function uninstallHooksCommand(options: { keepScript?: boolean } = {}): Promise<void> {
  console.log();
  console.log('\x1b[1m Uninstalling Genie Hooks\x1b[0m');
  console.log();

  // Step 1: Remove from Claude settings
  console.log('\x1b[2mRemoving from Claude Code settings...\x1b[0m');
  const settings = await loadClaudeSettings();

  if (!isGenieHookInstalled(settings)) {
    console.log('  \x1b[33m-\x1b[0m No genie hooks found in settings');
  } else {
    const updatedSettings = removeGenieHook(settings);
    await saveClaudeSettings(updatedSettings);
    console.log('  \x1b[32m+\x1b[0m Hook removed from ' + contractClaudePath(getClaudeSettingsPath()));
  }
  console.log();

  // Step 2: Remove hook script (unless --keep-script)
  if (!options.keepScript) {
    console.log('\x1b[2mRemoving hook script...\x1b[0m');
    if (hookScriptExists()) {
      removeHookScript();
      console.log('  \x1b[32m+\x1b[0m Deleted ' + getHookScriptDisplayPath());
    } else {
      console.log('  \x1b[33m-\x1b[0m Hook script not found');
    }
    console.log();
  } else {
    console.log('\x1b[2mKeeping hook script (--keep-script)\x1b[0m');
    console.log();
  }

  // Step 3: Print success
  printSuccessBox([
    '\x1b[32m+\x1b[0m Uninstallation complete!',
    '',
    'Restart Claude Code for changes to take effect.',
  ]);
}

/**
 * Test the hook script
 */
export async function testHooksCommand(): Promise<void> {
  console.log();
  console.log('\x1b[1m Testing Genie Hooks\x1b[0m');
  console.log();

  // Check if script exists
  if (!hookScriptExists()) {
    console.log('\x1b[31mError:\x1b[0m Hook script not found.');
    console.log('Run \x1b[36mgenie hooks install\x1b[0m first.');
    console.log();
    process.exit(1);
  }

  console.log('Script location: ' + getHookScriptDisplayPath());
  console.log();

  // Run test
  console.log('\x1b[2mTesting with sample Bash input...\x1b[0m');
  const result = await testHookScript();

  if (result.success) {
    console.log('\x1b[32m+\x1b[0m Hook script works correctly!');
    console.log();
    console.log('\x1b[2mSample output:\x1b[0m');
    try {
      const parsed = JSON.parse(result.output || '{}');
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(result.output);
    }
  } else {
    console.log('\x1b[31m-\x1b[0m Hook script test failed!');
    console.log();
    console.log('\x1b[31mError:\x1b[0m ' + result.error);
    if (result.output) {
      console.log();
      console.log('\x1b[2mOutput:\x1b[0m');
      console.log(result.output);
    }
    process.exit(1);
  }

  console.log();
}

/**
 * Show current hook configuration (moved from setup.ts)
 */
export async function showHooksCommand(): Promise<void> {
  const config = await loadGenieConfig();
  const descriptions = describeEnabledHooks(config);

  console.log();
  console.log('\x1b[1m Current Hook Configuration\x1b[0m');
  console.log(`   Genie config: ${contractClaudePath(getGenieConfigPath())}`);
  console.log(`   Claude settings: ${contractClaudePath(getClaudeSettingsPath())}`);
  console.log();

  // Show enabled presets
  if (descriptions.length === 0) {
    console.log('\x1b[33m   No hook presets enabled.\x1b[0m');
    console.log('   Run \x1b[36mgenie setup\x1b[0m to configure hooks.');
  } else {
    console.log('\x1b[2m   Enabled presets:\x1b[0m');
    for (const desc of descriptions) {
      console.log(`   \x1b[32m+\x1b[0m ${desc}`);
    }
  }
  console.log();

  // Show installation status
  const settings = await loadClaudeSettings();
  const installed = isGenieHookInstalled(settings);
  const scriptExists = hookScriptExists();

  console.log('\x1b[2m   Installation status:\x1b[0m');
  if (installed && scriptExists) {
    console.log('   \x1b[32m+\x1b[0m Hooks installed in Claude Code');
    console.log('   \x1b[32m+\x1b[0m Hook script exists');
  } else if (installed && !scriptExists) {
    console.log('   \x1b[33m!\x1b[0m Hook registered but script missing');
    console.log('   Run \x1b[36mgenie hooks install --force\x1b[0m to fix');
  } else if (!installed && scriptExists) {
    console.log('   \x1b[33m!\x1b[0m Script exists but hook not registered');
    console.log('   Run \x1b[36mgenie hooks install\x1b[0m to register');
  } else {
    console.log('   \x1b[33m-\x1b[0m Hooks not installed');
    console.log('   Run \x1b[36mgenie hooks install\x1b[0m to install');
  }

  console.log();
}
