import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { loadConfig } from '../lib/config.js';
import * as tmux from '../lib/tmux.js';

const exec = promisify(execCallback);

export async function launchProfile(profileName: string): Promise<void> {
  const config = await loadConfig();
  const profile = config.profiles[profileName];

  if (!profile) {
    console.error(`❌ Profile "${profileName}" not found`);
    console.log(`\nAvailable profiles: ${Object.keys(config.profiles).join(', ')}`);
    process.exit(1);
  }

  // Find next available session number
  const sessions = await tmux.listSessions();
  const existingNumbers = sessions
    .filter((s) => s.name.startsWith(`${profileName}-`))
    .map((s) => {
      const parts = s.name.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      return isNaN(num) ? 0 : num;
    })
    .filter((n) => n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  const sessionName = `${profileName}-${nextNumber}`;

  console.log(`🚀 Launching profile "${profileName}" in session "${sessionName}"...`);

  // Create tmux session
  const session = await tmux.createSession(sessionName);
  if (!session) {
    console.error('❌ Failed to create tmux session');
    process.exit(1);
  }

  // Get pane ID for the new session
  const windows = await tmux.listWindows(session.id);
  if (!windows || windows.length === 0) {
    console.error('❌ No windows found in session');
    await tmux.killSession(session.id);
    process.exit(1);
  }

  const panes = await tmux.listPanes(windows[0].id);
  if (!panes || panes.length === 0) {
    console.error('❌ No panes found in window');
    await tmux.killSession(session.id);
    process.exit(1);
  }

  const paneId = panes[0].id;

  // Set environment variables and start claude
  const envSetup = [
    `export LC_ALL=C.UTF-8`,
    `export LANG=C.UTF-8`,
    `export ANTHROPIC_BASE_URL="${config.apiUrl}"`,
    `export ANTHROPIC_AUTH_TOKEN="${config.apiKey}"`,
    `export ANTHROPIC_DEFAULT_OPUS_MODEL="${profile.opus}"`,
    `export ANTHROPIC_DEFAULT_SONNET_MODEL="${profile.sonnet}"`,
    `export ANTHROPIC_DEFAULT_HAIKU_MODEL="${profile.haiku}"`,
    `claude`,
  ].join('; ');

  await tmux.executeCommand(paneId, envSetup);

  console.log(`✅ Session "${sessionName}" created`);
  console.log(`\nAttaching to session...`);

  // Attach to session
  try {
    await exec(`tmux attach -t "${sessionName}"`);
  } catch (error: any) {
    console.error(`❌ Failed to attach to session: ${error.message}`);
    process.exit(1);
  }
}
