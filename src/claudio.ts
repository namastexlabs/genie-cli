#!/usr/bin/env bun

import { Command } from 'commander';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { setupCommand } from './commands/setup.js';
import { launchProfile } from './commands/launch.js';
import { configExists, deleteConfig } from './lib/config.js';

const exec = promisify(execCallback);
const program = new Command();

program
  .name('claudio')
  .description('Launch Claude Code with custom LLM router profiles')
  .version('0.1.0');

// Setup command
program
  .command('setup')
  .description('Run the setup wizard to configure profiles')
  .action(async () => {
    await setupCommand();
  });

// Handle profile launch or vanilla reset
program.action(async (options, command) => {
  const args = command.args;

  // No arguments - vanilla reset
  if (args.length === 0) {
    if (configExists()) {
      await deleteConfig();
      console.log('🧹 Config cleared');
    }

    console.log('🚀 Launching vanilla Claude...');
    try {
      await exec('claude');
    } catch (error: any) {
      console.error(`❌ Failed to launch Claude: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Profile name provided - launch profile
  const profileName = args[0];
  await launchProfile(profileName);
});

program.parse();
