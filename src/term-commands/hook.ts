import * as hookManager from '../lib/hook-manager.js';

export async function setHook(event: string, command: string): Promise<void> {
  try {
    await hookManager.setHook(event, command);
    console.log(`✅ Hook set: ${event} → ${command}`);
  } catch (error: any) {
    console.error(`❌ Error setting hook: ${error.message}`);
    process.exit(1);
  }
}

export async function listHooks(): Promise<void> {
  try {
    const hooks = await hookManager.listHooks();

    if (hooks.length === 0) {
      console.log('No hooks configured');
      return;
    }

    console.log('EVENT\t\t\t\tCOMMAND');
    console.log('─'.repeat(80));

    for (const hook of hooks) {
      console.log(`${hook.event}\t\t${hook.command}`);
    }
  } catch (error: any) {
    console.error(`❌ Error listing hooks: ${error.message}`);
    process.exit(1);
  }
}

export async function removeHook(event: string): Promise<void> {
  try {
    await hookManager.removeHook(event);
    console.log(`✅ Hook removed: ${event}`);
  } catch (error: any) {
    console.error(`❌ Error removing hook: ${error.message}`);
    process.exit(1);
  }
}
