import * as tmux from '../lib/tmux.js';

export async function removeSession(name: string): Promise<void> {
  try {
    // Check if session exists
    const session = await tmux.findSessionByName(name);
    if (!session) {
      console.error(`❌ Session "${name}" not found`);
      process.exit(1);
    }

    // Kill session
    await tmux.killSession(session.id);
    console.log(`✅ Session "${name}" removed`);
  } catch (error: any) {
    console.error(`❌ Error removing session: ${error.message}`);
    process.exit(1);
  }
}
