#!/usr/bin/env bun

import { Command } from 'commander';
import * as newCmd from './term-commands/new.js';
import * as lsCmd from './term-commands/ls.js';
import * as attachCmd from './term-commands/attach.js';
import * as rmCmd from './term-commands/rm.js';
import * as readCmd from './term-commands/read.js';
import * as execCmd from './term-commands/exec.js';
import * as sendCmd from './term-commands/send.js';
import * as splitCmd from './term-commands/split.js';
import * as hookCmd from './term-commands/hook.js';

const program = new Command();

program
  .name('term')
  .description('AI-friendly terminal orchestration (tmux wrapper)')
  .version('0.1.0');

// Session management
program
  .command('new <name>')
  .description('Create a new tmux session')
  .action(async (name: string) => {
    await newCmd.createNewSession(name);
  });

program
  .command('ls')
  .description('List all tmux sessions')
  .action(async () => {
    await lsCmd.listAllSessions();
  });

program
  .command('attach <name>')
  .description('Attach to a tmux session')
  .action(async (name: string) => {
    await attachCmd.attachToSession(name);
  });

program
  .command('rm <name>')
  .description('Remove a tmux session')
  .action(async (name: string) => {
    await rmCmd.removeSession(name);
  });

// Log reading (CRITICAL for AI orchestration)
program
  .command('read <session>')
  .description('Read logs from a tmux session')
  .option('-n, --lines <number>', 'Number of lines to read (default: 100)', '100')
  .option('--from <line>', 'Start line number')
  .option('--to <line>', 'End line number')
  .option('--range <range>', 'Line range (e.g., 100:200)')
  .option('--search <pattern>', 'Search for pattern')
  .option('--grep <pattern>', 'Regex search pattern')
  .option('-f, --follow', 'Follow mode (live tail)')
  .option('--all', 'Export entire scrollback buffer')
  .option('--reverse', 'Reverse chronological (newest first)')
  .action(async (session: string, options: any) => {
    await readCmd.readSessionLogs(session, options);
  });

// Command execution
program
  .command('exec <session> <command...>')
  .description('Execute command in a tmux session')
  .action(async (session: string, command: string[]) => {
    await execCmd.executeInSession(session, command.join(' '));
  });

program
  .command('send <session> <keys>')
  .description('Send raw keys to a tmux session')
  .action(async (session: string, keys: string) => {
    await sendCmd.sendKeysToSession(session, keys);
  });

// Pane management
program
  .command('split <session> [direction]')
  .description('Split pane in a tmux session (h=horizontal, v=vertical)')
  .action(async (session: string, direction?: string) => {
    await splitCmd.splitSessionPane(session, direction);
  });

// Hook management
const hookProgram = program.command('hook').description('Manage tmux hooks');

hookProgram
  .command('set <event> <command>')
  .description('Set a tmux hook')
  .action(async (event: string, command: string) => {
    await hookCmd.setHook(event, command);
  });

hookProgram
  .command('list')
  .description('List all tmux hooks')
  .action(async () => {
    await hookCmd.listHooks();
  });

hookProgram
  .command('rm <event>')
  .description('Remove a tmux hook')
  .action(async (event: string) => {
    await hookCmd.removeHook(event);
  });

program.parse();
