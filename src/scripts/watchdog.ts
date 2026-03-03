#!/usr/bin/env bun
/**
 * Watchdog entry point — runs the idle timeout loop.
 *
 * Spawned by `genie watchdog start` in a hidden tmux pane.
 * Exits when no active workers remain.
 */
import { runWatchdogLoop } from '../lib/idle-timeout.js';

await runWatchdogLoop();
