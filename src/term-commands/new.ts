import * as tmux from '../lib/tmux.js';

export async function createNewSession(name: string): Promise<void> {
  try {
    // Check if session already exists
    const existing = await tmux.findSessionByName(name);
    if (existing) {
      console.error(`❌ Session "${name}" already exists`);
      process.exit(1);
    }

    // Create session
    const session = await tmux.createSession(name);
    if (!session) {
      console.error(`❌ Failed to create session "${name}"`);
      process.exit(1);
    }

    console.log(`✅ Session "${name}" created`);
    console.log(`\nTo attach: term attach ${name}`);
  } catch (error: any) {
    console.error(`❌ Error creating session: ${error.message}`);
    process.exit(1);
  }
}
