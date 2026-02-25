#!/usr/bin/env bun

/**
 * genie — Single entrypoint CLI with namespaces:
 *   team, task, worker, msg, term
 *
 * DEC-1: One entrypoint (`genie`), with `genie term` as namespaced
 * low-level tmux operations. No split command surface.
 */

import { Command } from 'commander';
import { registerTeamNamespace } from './term-commands/team.js';
import { registerWorkerNamespace } from './term-commands/workers.js';
import { registerMsgNamespace } from './term-commands/msg.js';
import { registerTaskNamespace } from './term-commands/task/commands.js';
import { registerTermNamespace } from './term-commands/term.js';

const program = new Command();

program
  .name('genie')
  .description(`Genie CLI — Provider-selectable orchestration over tmux

TEAMS
  team create <name>       Create a team from a blueprint
  team list                List all teams
  team delete <name>       Delete a team

WORKERS
  worker spawn             Spawn a worker with provider selection
  worker list              List all workers with provider metadata
  worker kill <id>         Force kill a worker
  worker dashboard         Live status of all workers

TASKS
  task create <title>      Create a new task
  task list                List tasks (ready vs blocked)
  task update <id>         Update task properties

MESSAGES
  msg send --to <w> <body> Send message to a worker
  msg inbox <worker>       View worker inbox

TERMINAL (low-level tmux)
  term session ...         tmux session management

Examples:
  genie worker spawn --provider claude --team work --role implementor
  genie worker spawn --provider codex --team work --skill work --role tester
  genie msg send --to implementor 'ping'
  genie task list`)
  .version('0.0.1');

// Register all namespaces
registerTeamNamespace(program);
registerWorkerNamespace(program);
registerMsgNamespace(program);
registerTaskNamespace(program);
registerTermNamespace(program);

program.parse();
