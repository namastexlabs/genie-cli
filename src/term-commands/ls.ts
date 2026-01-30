import * as tmux from '../lib/tmux.js';

export async function listAllSessions(): Promise<void> {
  try {
    const sessions = await tmux.listSessions();

    if (sessions.length === 0) {
      console.log('No tmux sessions found');
      return;
    }

    // Docker ps style output
    console.log('SESSION ID\t\tNAME\t\t\tWINDOWS\t\tATTACHED');
    console.log('─'.repeat(80));

    for (const session of sessions) {
      const attached = session.attached ? 'yes' : 'no';
      console.log(`${session.id}\t${session.name}\t\t${session.windows}\t\t${attached}`);
    }
  } catch (error: any) {
    console.error(`❌ Error listing sessions: ${error.message}`);
    process.exit(1);
  }
}
