#!/usr/bin/env bun

import { Command } from 'commander';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { setupCommand } from './commands/setup.js';
import { launchProfile } from './commands/launch.js';
import { configExists, deleteConfig } from './lib/config.js';
import * as sessionCmd from './commands/session.js';
import * as windowCmd from './commands/window.js';
import * as paneCmd from './commands/pane.js';
import * as commandCmd from './commands/command.js';

const exec = promisify(execCallback);
const program = new Command();

program
  .name('claudio')
  .description('Claude CLI wrapper with tmux orchestration and custom model profiles')
  .version('0.1.0');

// Setup command
program
  .command('setup')
  .description('Run the setup wizard to configure profiles')
  .action(async () => {
    await setupCommand();
  });

// Session management commands
const sessionProgram = program.command('session').description('Manage tmux sessions');

sessionProgram
  .command('list')
  .description('List all tmux sessions')
  .action(async () => {
    await sessionCmd.listSessions();
  });

sessionProgram
  .command('create <name>')
  .description('Create a new tmux session')
  .action(async (name: string) => {
    await sessionCmd.createSession(name);
  });

sessionProgram
  .command('kill <id>')
  .description('Kill a tmux session by ID')
  .action(async (id: string) => {
    await sessionCmd.killSession(id);
  });

sessionProgram
  .command('find <name>')
  .description('Find a session by name')
  .action(async (name: string) => {
    await sessionCmd.findSession(name);
  });

// Window management commands
const windowProgram = program.command('window').description('Manage tmux windows');

windowProgram
  .command('list <session-id>')
  .description('List windows in a session')
  .action(async (sessionId: string) => {
    await windowCmd.listWindows(sessionId);
  });

windowProgram
  .command('create <session-id> <name>')
  .description('Create a new window in a session')
  .action(async (sessionId: string, name: string) => {
    await windowCmd.createWindow(sessionId, name);
  });

windowProgram
  .command('kill <window-id>')
  .description('Kill a window by ID')
  .action(async (windowId: string) => {
    await windowCmd.killWindow(windowId);
  });

// Pane management commands
const paneProgram = program.command('pane').description('Manage tmux panes');

paneProgram
  .command('list <window-id>')
  .description('List panes in a window')
  .action(async (windowId: string) => {
    await paneCmd.listPanes(windowId);
  });

paneProgram
  .command('split <pane-id>')
  .description('Split a pane')
  .option('-H, --horizontal', 'Split horizontally')
  .option('-V, --vertical', 'Split vertically (default)')
  .action(async (paneId: string, options: { horizontal?: boolean; vertical?: boolean }) => {
    const direction = options.horizontal ? 'horizontal' : 'vertical';
    await paneCmd.splitPane(paneId, direction);
  });

paneProgram
  .command('kill <pane-id>')
  .description('Kill a pane by ID')
  .action(async (paneId: string) => {
    await paneCmd.killPane(paneId);
  });

paneProgram
  .command('capture <pane-id>')
  .description('Capture content from a pane')
  .option('-l, --lines <number>', 'Number of lines to capture', '200')
  .action(async (paneId: string, options: { lines: string }) => {
    const lines = parseInt(options.lines, 10);
    await paneCmd.capturePane(paneId, lines);
  });

// Command execution commands
const commandProgram = program.command('command').description('Execute commands in tmux panes');

commandProgram
  .command('execute <pane-id> <command>')
  .description('Execute a command in a pane')
  .option('--raw', 'Execute in raw mode')
  .option('--no-enter', 'Do not send Enter key')
  .action(async (paneId: string, command: string, options: { raw?: boolean; noEnter?: boolean }) => {
    await commandCmd.executeCommand(paneId, command, options.raw, options.noEnter);
  });

commandProgram
  .command('get-result <command-id>')
  .description('Get the result of a command execution')
  .action(async (commandId: string) => {
    await commandCmd.getCommandResult(commandId);
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
