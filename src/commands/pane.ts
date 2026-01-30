import * as tmux from '../lib/tmux.js';

export async function listPanes(windowId: string): Promise<void> {
  const panes = await tmux.listPanes(windowId);

  if (panes.length === 0) {
    console.log('No panes found in window');
    return;
  }

  console.log(`\n📱 Panes in window "${windowId}":\n`);
  console.table(
    panes.map((p) => ({
      ID: p.id,
      Title: p.title,
      Active: p.active ? '✓' : '',
    }))
  );
}

export async function splitPane(
  paneId: string,
  direction: 'horizontal' | 'vertical'
): Promise<void> {
  console.log(`Splitting pane "${paneId}" ${direction}ly...`);
  const pane = await tmux.splitPane(paneId, direction);

  if (pane) {
    console.log(`✅ Pane split: ${pane.id}`);
  } else {
    console.error('❌ Failed to split pane');
    process.exit(1);
  }
}

export async function killPane(paneId: string): Promise<void> {
  console.log(`Killing pane "${paneId}"...`);
  try {
    await tmux.killPane(paneId);
    console.log(`✅ Pane killed`);
  } catch (error: any) {
    console.error(`❌ Failed to kill pane: ${error.message}`);
    process.exit(1);
  }
}

export async function capturePane(paneId: string, lines: number = 200): Promise<void> {
  console.log(`Capturing ${lines} lines from pane "${paneId}"...\n`);
  try {
    const content = await tmux.capturePaneContent(paneId, lines);
    console.log(content);
  } catch (error: any) {
    console.error(`❌ Failed to capture pane: ${error.message}`);
    process.exit(1);
  }
}
