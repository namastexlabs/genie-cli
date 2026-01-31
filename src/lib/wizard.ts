import { password as passwordPrompt } from '@inquirer/prompts';
import { testConnection, Model } from './api-client.js';
import { saveConfig, getDefaultApiUrl, configExists, loadConfig } from './config.js';
import { Config, Profile } from '../types/config.js';
import { pickProfileModels, promptText } from './picker.js';

export async function runSetupWizard(): Promise<void> {
  console.log('\n🔧 Claudio Setup\n');

  // 1. Prompt for API URL
  const defaultUrl = getDefaultApiUrl();
  const apiUrl = await promptText(`API URL`, defaultUrl);

  // 2. Prompt for API key (masked)
  const apiKey = await passwordPrompt({
    message: 'API Key:',
    mask: '*',
  });

  if (!apiKey) {
    console.error('\n❌ API key is required');
    process.exit(1);
  }

  // 3. Test connection
  process.stdout.write('\nTesting connection... ');
  const result = await testConnection(apiUrl, apiKey);

  if (!result.success) {
    console.log('❌');
    console.error(`\n❌ ${result.message}`);
    process.exit(1);
  }

  console.log(`✓ Connected (${result.modelCount} models available)`);

  // 4. Create first profile
  console.log('\nCreate your first profile:\n');

  const profileName = await promptText('Profile name', 'main');
  if (!profileName) {
    console.error('\n❌ Profile name is required');
    process.exit(1);
  }

  const models = result.models;
  const { opus, sonnet, haiku } = await pickProfileModels(models);

  const profile: Profile = { opus, sonnet, haiku };
  const profiles: Record<string, Profile> = { [profileName]: profile };

  // 5. Save config with first profile as default
  const config: Config = {
    apiUrl,
    apiKey,
    defaultProfile: profileName,
    profiles,
  };

  await saveConfig(config);

  console.log(`\n✓ Profile "${profileName}" created and set as default`);
  console.log(`\nRun \`claudio\` to launch, or \`claudio profiles add\` to create more.`);
}

export async function runAddProfileWizard(): Promise<void> {
  if (!configExists()) {
    console.error('❌ No config found. Run `claudio setup` first.');
    process.exit(1);
  }

  const config = await loadConfig();

  // Test connection to get models
  process.stdout.write('Fetching models... ');
  const result = await testConnection(config.apiUrl, config.apiKey);

  if (!result.success) {
    console.log('❌');
    console.error(`\n❌ ${result.message}`);
    process.exit(1);
  }

  console.log(`✓ (${result.modelCount} models)`);
  console.log('');

  const profileName = await promptText('Profile name');
  if (!profileName) {
    console.error('\n❌ Profile name is required');
    process.exit(1);
  }

  if (config.profiles[profileName]) {
    console.error(`\n❌ Profile "${profileName}" already exists`);
    process.exit(1);
  }

  const { opus, sonnet, haiku } = await pickProfileModels(result.models);

  config.profiles[profileName] = { opus, sonnet, haiku };
  await saveConfig(config);

  console.log(`\n✓ Profile "${profileName}" created`);
}
