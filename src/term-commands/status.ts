import * as tmux from '../lib/tmux.js';

export interface StatusOptions {
  command?: string;
  json?: boolean;
}

interface SessionStatus {
  session: string;
  id: string;
  attached: boolean;
  windows: number;
  panes: number;
  state: 'idle' | 'busy';
}

interface CommandStatus {
  id: string;
  paneId: string;
  command: string;
  status: 'pending' | 'completed' | 'error';
  exitCode?: number;
  startTime: string;
  result?: string;
}

export async function getStatus(session: string, options: StatusOptions = {}): Promise<void> {
  try {
    // If checking a specific command
    if (options.command) {
      await getCommandStatus(options.command, options.json);
      return;
    }

    // Find session by name
    const sessionObj = await tmux.findSessionByName(session);
    if (!sessionObj) {
      console.error(`Session "${session}" not found`);
      process.exit(1);
    }

    // Get windows and panes
    const windows = await tmux.listWindows(sessionObj.id);
    let totalPanes = 0;

    for (const window of windows) {
      const panes = await tmux.listPanes(window.id);
      totalPanes += panes.length;
    }

    // Determine state (simplified: idle if session exists, could be enhanced with activity detection)
    const state: 'idle' | 'busy' = 'idle';

    const status: SessionStatus = {
      session: sessionObj.name,
      id: sessionObj.id,
      attached: sessionObj.attached,
      windows: windows.length,
      panes: totalPanes,
      state,
    };

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log(`Session: ${status.session}`);
    console.log(`ID: ${status.id}`);
    console.log(`Attached: ${status.attached ? 'yes' : 'no'}`);
    console.log(`Windows: ${status.windows}`);
    console.log(`Panes: ${status.panes}`);
    console.log(`State: ${status.state}`);
  } catch (error: any) {
    console.error(`Error getting status: ${error.message}`);
    process.exit(1);
  }
}

async function getCommandStatus(commandId: string, json?: boolean): Promise<void> {
  try {
    const result = await tmux.checkCommandStatus(commandId);

    if (!result) {
      console.error(`Command "${commandId}" not found`);
      process.exit(1);
    }

    const status: CommandStatus = {
      id: result.id,
      paneId: result.paneId,
      command: result.command,
      status: result.status,
      exitCode: result.exitCode,
      startTime: result.startTime.toISOString(),
      result: result.result,
    };

    if (json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log(`Command: ${status.id}`);
    console.log(`Status: ${status.status}`);
    console.log(`Exit Code: ${status.exitCode ?? 'N/A'}`);
    console.log(`Start Time: ${status.startTime}`);

    if (status.result) {
      console.log(`\nOutput:\n${status.result}`);
    }
  } catch (error: any) {
    console.error(`Error getting command status: ${error.message}`);
    process.exit(1);
  }
}
