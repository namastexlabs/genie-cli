import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, copyFile, chmod } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const GENIE_HOME = process.env.GENIE_HOME || join(homedir(), '.genie');
const GENIE_SRC = join(GENIE_HOME, 'src');
const GENIE_BIN = join(GENIE_HOME, 'bin');
const LOCAL_BIN = join(homedir(), '.local', 'bin');

function log(message: string): void {
  console.log(`\x1b[32m▸\x1b[0m ${message}`);
}

function success(message: string): void {
  console.log(`\x1b[32m✔\x1b[0m ${message}`);
}

function error(message: string): void {
  console.log(`\x1b[31m✖\x1b[0m ${message}`);
}

function warn(message: string): void {
  console.log(`\x1b[33m⚠\x1b[0m ${message}`);
}

async function runCommand(command: string, args: string[], cwd?: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const output: string[] = [];

    const child = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    child.stdout?.on('data', (data) => {
      const str = data.toString();
      output.push(str);
      process.stdout.write(str);
    });

    child.stderr?.on('data', (data) => {
      const str = data.toString();
      output.push(str);
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, output: output.join('') });
    });

    child.on('error', (err) => {
      error(err.message);
      resolve({ success: false, output: err.message });
    });
  });
}

async function getGitInfo(cwd: string): Promise<{ branch: string; commit: string; commitDate: string } | null> {
  try {
    const branchResult = await runCommandSilent('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const commitResult = await runCommandSilent('git', ['rev-parse', '--short', 'HEAD'], cwd);
    const dateResult = await runCommandSilent('git', ['log', '-1', '--format=%ci'], cwd);

    if (branchResult.success && commitResult.success && dateResult.success) {
      return {
        branch: branchResult.output.trim(),
        commit: commitResult.output.trim(),
        commitDate: dateResult.output.trim().split(' ')[0], // Just the date part
      };
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function runCommandSilent(command: string, args: string[], cwd?: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const output: string[] = [];

    const child = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data) => {
      output.push(data.toString());
    });

    child.stderr?.on('data', (data) => {
      output.push(data.toString());
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, output: output.join('') });
    });

    child.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

async function symlinkOrCopy(src: string, dest: string): Promise<void> {
  const { symlink, unlink } = await import('fs/promises');

  try {
    // Remove existing symlink/file if present
    if (existsSync(dest)) {
      await unlink(dest);
    }
    await symlink(src, dest);
  } catch {
    // Fallback to copy if symlink fails
    await copyFile(src, dest);
  }
}

export async function updateCommand(): Promise<void> {
  console.log();
  console.log('\x1b[1m🧞 Genie CLI Update\x1b[0m');
  console.log('\x1b[2m────────────────────────────────────\x1b[0m');
  console.log();

  // Check if installed via install.sh (has ~/.genie/src)
  if (!existsSync(GENIE_SRC) || !existsSync(join(GENIE_SRC, '.git'))) {
    error('Genie CLI was not installed via install.sh');
    console.log();
    console.log('To install Genie CLI properly, run:');
    console.log('\x1b[36m  curl -fsSL https://raw.githubusercontent.com/namastexlabs/genie-cli/main/install.sh | bash\x1b[0m');
    console.log();
    process.exit(1);
  }

  // Get current version info before update
  const beforeInfo = await getGitInfo(GENIE_SRC);
  if (beforeInfo) {
    console.log(`Current: \x1b[2m${beforeInfo.branch}@${beforeInfo.commit} (${beforeInfo.commitDate})\x1b[0m`);
    console.log();
  }

  // Step 1: Fetch and reset to origin/main
  log('Fetching latest changes...');
  const fetchResult = await runCommand('git', ['fetch', 'origin'], GENIE_SRC);
  if (!fetchResult.success) {
    error('Failed to fetch from origin');
    process.exit(1);
  }

  log('Resetting to origin/main...');
  const resetResult = await runCommand('git', ['reset', '--hard', 'origin/main'], GENIE_SRC);
  if (!resetResult.success) {
    error('Failed to reset to origin/main');
    process.exit(1);
  }
  console.log();

  // Get new version info
  const afterInfo = await getGitInfo(GENIE_SRC);

  // Check if anything changed
  if (beforeInfo && afterInfo && beforeInfo.commit === afterInfo.commit) {
    success('Already up to date!');
    console.log();
    return;
  }

  // Step 2: Install dependencies
  log('Installing dependencies...');
  const installResult = await runCommand('bun', ['install'], GENIE_SRC);
  if (!installResult.success) {
    error('Failed to install dependencies');
    process.exit(1);
  }
  console.log();

  // Step 3: Build
  log('Building...');
  const buildResult = await runCommand('bun', ['run', 'build'], GENIE_SRC);
  if (!buildResult.success) {
    error('Failed to build');
    process.exit(1);
  }
  console.log();

  // Step 4: Copy binaries and update symlinks
  log('Installing binaries...');

  try {
    await mkdir(GENIE_BIN, { recursive: true });
    await mkdir(LOCAL_BIN, { recursive: true });

    const binaries = ['genie.js', 'term.js', 'claudio.js'];
    const names = ['genie', 'term', 'claudio'];

    for (let i = 0; i < binaries.length; i++) {
      const src = join(GENIE_SRC, 'dist', binaries[i]);
      const binDest = join(GENIE_BIN, binaries[i]);
      const linkDest = join(LOCAL_BIN, names[i]);

      // Copy to GENIE_BIN
      await copyFile(src, binDest);
      await chmod(binDest, 0o755);

      // Symlink to LOCAL_BIN
      await symlinkOrCopy(binDest, linkDest);
    }

    success('Binaries installed');
  } catch (err) {
    error(`Failed to install binaries: ${err}`);
    process.exit(1);
  }

  // Print success
  console.log();
  console.log('\x1b[2m────────────────────────────────────\x1b[0m');
  success('Genie CLI updated successfully!');
  console.log();

  if (afterInfo) {
    console.log(`Version: \x1b[36m${afterInfo.branch}@${afterInfo.commit}\x1b[0m (${afterInfo.commitDate})`);
    console.log();
  }
}
