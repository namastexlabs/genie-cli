import { spawn } from 'child_process';
import { loadConfig, getDefaultProfile, configExists } from '../lib/config.js';
import * as tmux from '../lib/tmux.js';

const SESSION_NAME = 'genie';

export async function launchProfile(profileName: string): Promise<void> {
  const config = await loadConfig();
  const profile = config.profiles[profileName];

  if (!profile) {
    console.error(`❌ Profile "${profileName}" not found`);
    console.log(`\nAvailable profiles: ${Object.keys(config.profiles).join(', ')}`);
    process.exit(1);
  }

  const isInsideTmux = !!process.env.TMUX;

  // Environment setup command
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

  if (isInsideTmux) {
    // Already inside tmux - just create a new window
    console.log(`🚀 Opening "${profileName}" in new window...`);

    // Get current session from $TMUX
    const currentSession = await tmux.getCurrentSessionId();

    // Create new window named after the profile
    const window = await tmux.createWindow(currentSession, profileName);
    if (!window) {
      console.error('❌ Failed to create window');
      process.exit(1);
    }

    // Get the pane in the new window
    const panes = await tmux.listPanes(window.id);
    const paneId = panes[0].id;

    // Execute the environment setup and launch claude
    await tmux.executeCommand(paneId, envSetup);

    console.log(`✅ Window "${profileName}" created`);
    // No need to attach - already in tmux, auto-switches to new window
  } else {
    // Outside tmux - create or reuse "genie" session
    let session = await tmux.findSessionByName(SESSION_NAME);

    if (session) {
      // Session exists - add a new window
      console.log(`🚀 Adding "${profileName}" to session "${SESSION_NAME}"...`);

      const window = await tmux.createWindow(session.id, profileName);
      if (!window) {
        console.error('❌ Failed to create window');
        process.exit(1);
      }

      const panes = await tmux.listPanes(window.id);
      await tmux.executeCommand(panes[0].id, envSetup);
    } else {
      // No session - create it
      console.log(`🚀 Creating session "${SESSION_NAME}" with "${profileName}"...`);

      session = await tmux.createSession(SESSION_NAME);
      if (!session) {
        console.error('❌ Failed to create tmux session');
        process.exit(1);
      }

      // Rename the default window to the profile name
      const windows = await tmux.listWindows(session.id);
      await tmux.renameWindow(windows[0].id, profileName);

      const panes = await tmux.listPanes(windows[0].id);
      await tmux.executeCommand(panes[0].id, envSetup);
    }

    console.log(`✅ Ready`);
    console.log(`\nAttaching to session...`);

    // Attach to session
    const child = spawn('tmux', ['attach', '-t', SESSION_NAME], {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      console.error(`❌ Failed to attach: ${error.message}`);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}

export async function launchDefaultProfile(): Promise<void> {
  if (!configExists()) {
    console.error('❌ No config found. Run `claudio setup` first.');
    process.exit(1);
  }

  const defaultProfile = await getDefaultProfile();

  if (!defaultProfile) {
    console.error('❌ No default profile set.');
    console.log('\nRun `claudio setup` to configure, or use `claudio <profile>` to launch a specific profile.');
    process.exit(1);
  }

  await launchProfile(defaultProfile);
}
