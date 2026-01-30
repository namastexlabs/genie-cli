import * as tmux from '../lib/tmux.js';

export async function sendKeysToSession(sessionName: string, keys: string): Promise<void> {
  try {
    // Find session
    const session = await tmux.findSessionByName(sessionName);
    if (!session) {
      console.error(`❌ Session "${sessionName}" not found`);
      process.exit(1);
    }

    // Get first window and pane
    const windows = await tmux.listWindows(session.id);
    if (!windows || windows.length === 0) {
      console.error(`❌ No windows found in session "${sessionName}"`);
      process.exit(1);
    }

    const panes = await tmux.listPanes(windows[0].id);
    if (!panes || panes.length === 0) {
      console.error(`❌ No panes found in session "${sessionName}"`);
      process.exit(1);
    }

    const paneId = panes[0].id;

    // Send keys without Enter
    await tmux.executeCommand(paneId, keys, false, true);
    console.log(`✅ Keys sent to session "${sessionName}"`);
  } catch (error: any) {
    console.error(`❌ Error sending keys: ${error.message}`);
    process.exit(1);
  }
}
