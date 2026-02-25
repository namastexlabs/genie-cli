#!/usr/bin/env bun

/**
 * term — Low-level tmux operations, kept as a namespaced subcommand
 * under `genie term`. This file can also run standalone for
 * backward compatibility.
 */

import { Command } from 'commander';

const program = new Command();

program
  .name('term')
  .description('Low-level tmux session/pane operations (namespaced under genie term)')
  .version('0.0.1');

// Placeholder: session subcommands would be registered here
// In a full build, we'd import from term-commands/ as in the production repo.
// For this wish, the term surface is preserved as-is and wired
// through genie.ts as `genie term`.

program
  .command('session')
  .description('tmux session management (new, ls, attach, rm, exec, send, read)')
  .action(() => {
    console.log('Use `genie term session <subcommand>`. See --help for details.');
  });

program.parse();
