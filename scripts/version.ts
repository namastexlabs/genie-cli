#!/usr/bin/env bun

/**
 * Pre-build script: generates datetime-based version and updates files
 * Format: 0.YYMMDD.HHMM (e.g., 0.260201.1430 = Feb 1, 2026 at 14:30)
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

// Generate version from current datetime
function generateVersion(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  return `0.${yy}${mm}${dd}.${hh}${min}`;
}

async function main() {
  const version = generateVersion();
  const rootDir = join(dirname(import.meta.path), '..');

  // Update package.json
  const packagePath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
  packageJson.version = version;
  await writeFile(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  // Update src/lib/version.ts
  const versionPath = join(rootDir, 'src/lib/version.ts');
  const versionContent = await readFile(versionPath, 'utf-8');
  const updatedContent = versionContent.replace(
    /export const VERSION = '[^']+';/,
    `export const VERSION = '${version}';`
  );
  await writeFile(versionPath, updatedContent);

  console.log(`Version: ${version}`);
}

main().catch((err) => {
  console.error('Version script failed:', err);
  process.exit(1);
});
