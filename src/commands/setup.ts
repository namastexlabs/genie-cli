import { runSetupWizard } from '../lib/wizard.js';

export async function setupCommand(): Promise<void> {
  await runSetupWizard();
}
