#!/usr/bin/env bun

import { Command } from 'commander';
import { installCommand } from './genie-commands/install.js';

const program = new Command();

program
  .name('genie')
  .description('Genie CLI - Setup and utilities')
  .version('0.1.0');

program
  .command('install')
  .description('Verify and install prerequisites')
  .option('--check', 'Only check prerequisites, do not install')
  .option('--yes', 'Auto-approve all installations')
  .action(installCommand);

program.parse();
