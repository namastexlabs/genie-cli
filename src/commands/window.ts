import * as tmux from '../lib/tmux.js';

export async function listWindows(sessionId: string): Promise<void> {
  const windows = await tmux.listWindows(sessionId);

  if (windows.length === 0) {
    console.log('No windows found in session');
    return;
  }

  console.log(`\n🪟 Windows in session "${sessionId}":\n`);
  console.table(
    windows.map((w) => ({
      ID: w.id,
      Name: w.name,
      Active: w.active ? '✓' : '',
    }))
  );
}

export async function createWindow(sessionId: string, name: string): Promise<void> {
  console.log(`Creating window "${name}" in session "${sessionId}"...`);
  const window = await tmux.createWindow(sessionId, name);

  if (window) {
    console.log(`✅ Window created: ${window.id}`);
  } else {
    console.error('❌ Failed to create window');
    process.exit(1);
  }
}

export async function killWindow(windowId: string): Promise<void> {
  console.log(`Killing window "${windowId}"...`);
  try {
    await tmux.killWindow(windowId);
    console.log(`✅ Window killed`);
  } catch (error: any) {
    console.error(`❌ Failed to kill window: ${error.message}`);
    process.exit(1);
  }
}
