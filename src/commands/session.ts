import * as tmux from '../lib/tmux.js';

export async function listSessions(): Promise<void> {
  const sessions = await tmux.listSessions();

  if (sessions.length === 0) {
    console.log('No tmux sessions found');
    return;
  }

  console.log('\n📋 Tmux Sessions:\n');
  console.table(
    sessions.map((s) => ({
      ID: s.id,
      Name: s.name,
      Attached: s.attached ? '✓' : '',
      Windows: s.windows,
    }))
  );
}

export async function createSession(name: string): Promise<void> {
  console.log(`Creating session "${name}"...`);
  const session = await tmux.createSession(name);

  if (session) {
    console.log(`✅ Session created: ${session.id}`);
  } else {
    console.error('❌ Failed to create session');
    process.exit(1);
  }
}

export async function killSession(sessionId: string): Promise<void> {
  console.log(`Killing session "${sessionId}"...`);
  try {
    await tmux.killSession(sessionId);
    console.log(`✅ Session killed`);
  } catch (error: any) {
    console.error(`❌ Failed to kill session: ${error.message}`);
    process.exit(1);
  }
}

export async function findSession(name: string): Promise<void> {
  const session = await tmux.findSessionByName(name);

  if (session) {
    console.log(`\n✅ Found session:\n`);
    console.table({
      ID: session.id,
      Name: session.name,
      Attached: session.attached ? '✓' : '',
      Windows: session.windows,
    });
  } else {
    console.log(`❌ Session "${name}" not found`);
  }
}
