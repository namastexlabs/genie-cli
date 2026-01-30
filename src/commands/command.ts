import * as tmux from '../lib/tmux.js';

export async function executeCommand(
  paneId: string,
  command: string,
  raw: boolean = false,
  noEnter: boolean = false
): Promise<void> {
  console.log(`Executing command in pane "${paneId}"...`);
  const commandId = await tmux.executeCommand(paneId, command, raw, noEnter);
  console.log(`✅ Command executed. ID: ${commandId}`);
  console.log(`\nUse "claudio command get-result ${commandId}" to get the result`);
}

export async function getCommandResult(commandId: string): Promise<void> {
  console.log(`Checking command "${commandId}"...\n`);

  const result = await tmux.checkCommandStatus(commandId);

  if (!result) {
    console.log('❌ Command not found');
    return;
  }

  console.table({
    ID: result.id,
    Status: result.status,
    'Exit Code': result.exitCode ?? 'N/A',
    'Start Time': result.startTime.toISOString(),
  });

  if (result.result) {
    console.log(`\n📤 Output:\n`);
    console.log(result.result);
  }
}
