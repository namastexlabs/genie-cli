import * as tmux from '../lib/tmux.js';

export interface WindowListOptions {
  json?: boolean;
}

export async function listWindows(session: string, options: WindowListOptions = {}): Promise<void> {
  try {
    // Find session by name first
    const sessionObj = await tmux.findSessionByName(session);
    if (!sessionObj) {
      console.error(`Session "${session}" not found`);
      process.exit(1);
    }

    const windows = await tmux.listWindows(sessionObj.id);

    if (options.json) {
      console.log(JSON.stringify(windows, null, 2));
      return;
    }

    if (windows.length === 0) {
      console.log('No windows found');
      return;
    }

    console.log('WINDOW ID\t\tNAME\t\t\tACTIVE');
    console.log('─'.repeat(60));

    for (const window of windows) {
      const active = window.active ? 'yes' : 'no';
      console.log(`${window.id}\t\t${window.name}\t\t\t${active}`);
    }
  } catch (error: any) {
    console.error(`Error listing windows: ${error.message}`);
    process.exit(1);
  }
}

export async function createWindow(session: string, name: string): Promise<void> {
  try {
    // Find session by name first
    const sessionObj = await tmux.findSessionByName(session);
    if (!sessionObj) {
      console.error(`Session "${session}" not found`);
      process.exit(1);
    }

    const window = await tmux.createWindow(sessionObj.id, name);

    if (window) {
      console.log(`Window created: ${window.id}`);
    } else {
      console.error('Failed to create window');
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error creating window: ${error.message}`);
    process.exit(1);
  }
}

export async function removeWindow(windowId: string): Promise<void> {
  try {
    await tmux.killWindow(windowId);
    console.log(`Window removed: ${windowId}`);
  } catch (error: any) {
    console.error(`Error removing window: ${error.message}`);
    process.exit(1);
  }
}
