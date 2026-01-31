import * as tmux from '../lib/tmux.js';

export interface PaneListOptions {
  json?: boolean;
}

export async function listPanes(session: string, options: PaneListOptions = {}): Promise<void> {
  try {
    // Find session by name first
    const sessionObj = await tmux.findSessionByName(session);
    if (!sessionObj) {
      console.error(`Session "${session}" not found`);
      process.exit(1);
    }

    // Get all windows in session
    const windows = await tmux.listWindows(sessionObj.id);
    if (windows.length === 0) {
      if (options.json) {
        console.log('[]');
      } else {
        console.log('No panes found');
      }
      return;
    }

    // Collect all panes from all windows
    const allPanes: Array<{
      id: string;
      windowId: string;
      windowName: string;
      title: string;
      active: boolean;
    }> = [];

    for (const window of windows) {
      const panes = await tmux.listPanes(window.id);
      for (const pane of panes) {
        allPanes.push({
          id: pane.id,
          windowId: window.id,
          windowName: window.name,
          title: pane.title,
          active: pane.active,
        });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(allPanes, null, 2));
      return;
    }

    if (allPanes.length === 0) {
      console.log('No panes found');
      return;
    }

    console.log('PANE ID\t\tWINDOW\t\t\tTITLE\t\t\tACTIVE');
    console.log('─'.repeat(80));

    for (const pane of allPanes) {
      const active = pane.active ? 'yes' : 'no';
      const title = pane.title || '-';
      console.log(`${pane.id}\t\t${pane.windowName}\t\t\t${title}\t\t\t${active}`);
    }
  } catch (error: any) {
    console.error(`Error listing panes: ${error.message}`);
    process.exit(1);
  }
}

export async function removePane(paneId: string): Promise<void> {
  try {
    await tmux.killPane(paneId);
    console.log(`Pane removed: ${paneId}`);
  } catch (error: any) {
    console.error(`Error removing pane: ${error.message}`);
    process.exit(1);
  }
}
