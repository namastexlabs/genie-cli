#!/usr/bin/env bun

import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { launchProfile, launchDefaultProfile } from './commands/launch.js';
import {
  profilesListCommand,
  profilesAddCommand,
  profilesRemoveCommand,
  profilesDefaultCommand,
  profilesShowCommand,
} from './commands/profiles.js';
import { modelsCommand, configCommand } from './commands/models.js';

const program = new Command();

program
  .name('claudio')
  .description('Launch Claude Code with custom LLM router profiles')
  .version('0.2.0');

// Setup command
program
  .command('setup')
  .description('First-time setup wizard')
  .action(async () => {
    await setupCommand();
  });

// Profiles command with subcommands
const profiles = program
  .command('profiles')
  .description('Manage profiles');

profiles
  .command('list', { isDefault: true })
  .description('List all profiles (* = default)')
  .action(async () => {
    await profilesListCommand();
  });

profiles
  .command('add')
  .description('Add new profile (interactive picker)')
  .action(async () => {
    await profilesAddCommand();
  });

profiles
  .command('rm <name>')
  .description('Delete profile')
  .action(async (name: string) => {
    await profilesRemoveCommand(name);
  });

profiles
  .command('default <name>')
  .description('Set default profile')
  .action(async (name: string) => {
    await profilesDefaultCommand(name);
  });

profiles
  .command('show <name>')
  .description('Show profile details')
  .action(async (name: string) => {
    await profilesShowCommand(name);
  });

// Models command
program
  .command('models')
  .description('List available models from router')
  .action(async () => {
    await modelsCommand();
  });

// Config command
program
  .command('config')
  .description('Show current config (URL, default profile)')
  .action(async () => {
    await configCommand();
  });

// Handle profile launch (no args = default, or named profile)
program.action(async (options, command) => {
  const args = command.args;

  if (args.length === 0) {
    // No arguments - launch default profile
    await launchDefaultProfile();
    return;
  }

  // Profile name provided - launch named profile
  const profileName = args[0];
  await launchProfile(profileName);
});

program.parse();
