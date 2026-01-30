import { createInterface } from 'readline';
import { validateApiKeyAndGetModels, Model } from './api-client.js';
import { saveConfig, getDefaultApiUrl } from './config.js';
import { Config, Profile } from '../types/config.js';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    readline.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

function selectFromList(items: string[], prompt: string): Promise<string> {
  return new Promise(async (resolve) => {
    console.log(`\n${prompt}`);
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });

    const answer = await question('\nSelect (number): ');
    const index = parseInt(answer, 10) - 1;

    if (index >= 0 && index < items.length) {
      resolve(items[index]);
    } else {
      console.log('Invalid selection, please try again.');
      resolve(await selectFromList(items, prompt));
    }
  });
}

export async function runSetupWizard(): Promise<void> {
  console.log('\n🧙 Claudio Setup Wizard\n');

  // 1. Prompt for API URL
  const defaultUrl = getDefaultApiUrl();
  const apiUrlInput = await question(`API URL [${defaultUrl}]: `);
  const apiUrl = apiUrlInput || defaultUrl;

  // 2. Prompt for API key
  const apiKey = await question('API Key: ');

  if (!apiKey) {
    console.error('❌ API key is required');
    readline.close();
    process.exit(1);
  }

  // 3. Validate key and fetch models
  console.log('\n🔍 Validating API key...');
  const models = await validateApiKeyAndGetModels(apiUrl, apiKey);

  if (!models || models.length === 0) {
    console.error('❌ Invalid API key or URL, or no models available');
    readline.close();
    process.exit(1);
  }

  console.log(`✅ Found ${models.length} models`);

  // 4. Create profiles loop
  const profiles: Record<string, Profile> = {};
  let createMore = true;

  while (createMore) {
    console.log('\n📝 Create a new profile');

    const name = await question('Profile name: ');
    if (!name) {
      console.log('⚠️  Profile name cannot be empty, skipping...');
      continue;
    }

    const modelIds = models.map((m) => m.id);

    const opus = await selectFromList(modelIds, 'Select OPUS model:');
    const sonnet = await selectFromList(modelIds, 'Select SONNET model:');
    const haiku = await selectFromList(modelIds, 'Select HAIKU model:');

    profiles[name] = { opus, sonnet, haiku };
    console.log(`✅ Profile "${name}" created`);

    const more = await question('\nCreate another profile? (y/N): ');
    createMore = more.toLowerCase() === 'y' || more.toLowerCase() === 'yes';
  }

  // 5. Save config
  const config: Config = {
    apiUrl,
    apiKey,
    profiles,
  };

  await saveConfig(config);
  console.log(`\n✅ Setup complete! Config saved to ~/.claudio/config.json`);
  console.log(`\n📋 Created profiles: ${Object.keys(profiles).join(', ')}`);

  readline.close();
}
