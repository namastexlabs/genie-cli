/**
 * Wish Namespace - Wish document management & collaborative editing
 *
 * Groups all wish-related commands under `term wish`.
 *
 * Commands:
 *   term wish ls                    - List all wishes
 *   term wish status <slug>         - Show wish with linked tasks status
 *   term wish show <slug>           - Alias for status
 *   term wish read <slug>           - Read wish document (or specific section)
 *   term wish edit <slug>           - Edit a wish document section
 *   term wish set-status <slug> <s> - Update wish status field
 *   term wish append <slug>         - Append a new section
 *   term wish changelog <slug>      - View edit history
 *   term wish sections <slug>       - List all sections in a wish
 *   term wish diff <slug>           - Check for changes since timestamp
 */

import { Command } from 'commander';
import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { getWishTasks, getWishStatus, LinkedTask } from '../../lib/wish-tasks.js';
import {
  readWish,
  editWish,
  readChangelog,
  hasChanges,
  findSection,
  listSections,
  wishExists,
  getWishPath,
  type WishEdit,
  type ChangelogEntry,
} from '../../lib/wish-editor.js';

// ============================================================================
// Types
// ============================================================================

interface WishSummary {
  slug: string;
  title: string;
  status: string;
  tasks: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    open: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the wishes directory path
 */
function getWishesDir(repoPath: string): string {
  return join(repoPath, '.genie', 'wishes');
}

/**
 * Parse wish.md frontmatter to get status and title
 */
async function parseWishFrontmatter(wishPath: string): Promise<{ title: string; status: string }> {
  try {
    const content = await readFile(wishPath, 'utf-8');
    const lines = content.split('\n');

    let title = '';
    let status = 'DRAFT';

    // Parse frontmatter
    if (lines[0]?.trim() === '---') {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') break;

        if (line.startsWith('title:')) {
          title = line.substring(6).trim().replace(/^["']|["']$/g, '');
        }
        if (line.startsWith('status:')) {
          status = line.substring(7).trim().toUpperCase();
        }
      }
    }

    // Fallback: look for **Status:** pattern (wish.md style)
    if (status === 'DRAFT') {
      const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
      if (statusMatch) {
        status = statusMatch[1].trim().toUpperCase();
      }
    }

    // Fallback: look for # heading
    if (!title) {
      const heading = lines.find(l => l.startsWith('# '));
      if (heading) {
        title = heading.substring(2).trim();
      }
    }

    return { title: title || '(untitled)', status };
  } catch {
    return { title: '(error reading)', status: 'UNKNOWN' };
  }
}

/**
 * List all wishes in the repository
 */
async function listWishes(repoPath: string): Promise<WishSummary[]> {
  const wishesDir = getWishesDir(repoPath);
  const wishes: WishSummary[] = [];

  try {
    const entries = await readdir(wishesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const wishPath = join(wishesDir, entry.name, 'wish.md');
        try {
          await access(wishPath);
          const { title, status } = await parseWishFrontmatter(wishPath);
          const tasks = await getWishStatus(repoPath, entry.name);

          wishes.push({
            slug: entry.name,
            title,
            status,
            tasks,
          });
        } catch {
          // Skip if wish.md doesn't exist
        }
      }
    }
  } catch {
    // Wishes directory doesn't exist
  }

  return wishes;
}

/**
 * Format task status with emoji
 */
function formatTaskStatus(status: LinkedTask['status']): string {
  switch (status) {
    case 'done': return '\u2705';
    case 'in_progress': return '\uD83D\uDD04';
    case 'blocked': return '\uD83D\uDD34';
    case 'open': return '\u26AA';
    default: return '\u2753';
  }
}

/**
 * Format wish status with emoji
 */
function formatWishStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'READY': return '\uD83D\uDFE2 READY';
    case 'APPROVED': return '\uD83D\uDFE2 APPROVED';
    case 'IN_PROGRESS': return '\uD83D\uDD04 IN_PROGRESS';
    case 'BLOCKED': return '\uD83D\uDD34 BLOCKED';
    case 'DONE': return '\u2705 DONE';
    case 'DRAFT': return '\uD83D\uDCDD DRAFT';
    default: return status;
  }
}

/**
 * Format a changelog entry for display
 */
function formatChangelogEntry(entry: ChangelogEntry): string {
  const time = new Date(entry.timestamp).toLocaleString();
  const section = entry.section ? ` [${entry.section}]` : '';
  return `  ${time}  ${entry.author}  ${entry.editType}${section}\n    ${entry.summary}`;
}

/**
 * Get default author name from environment
 */
function getAuthorName(): string {
  return process.env.GENIE_AUTHOR
    || process.env.CLAUDE_SESSION_ID
    || process.env.USER
    || 'unknown';
}

// ============================================================================
// Register Namespace
// ============================================================================

/**
 * Register the `term wish` namespace with all subcommands
 */
export function registerWishNamespace(program: Command): void {
  const wishProgram = program
    .command('wish')
    .description(`Wish document management and collaborative editing

BROWSE
  wish ls                         List all wishes
  wish status <slug>              Wish status with linked tasks
  wish show <slug>                Alias for status

READ / INSPECT
  wish read <slug>                Read wish document (or section with --section)
  wish sections <slug>            List all sections in a wish

COLLABORATIVE EDITING
  wish edit <slug>                Replace a section in a wish
  wish set-status <slug> <status> Update wish status (DRAFT/APPROVED/IN_PROGRESS/DONE)
  wish append <slug>              Append a new section to a wish
  wish set-field <slug> <field>   Update any **Field:** value in the document

HISTORY
  wish changelog <slug>           View edit history
  wish diff <slug>                Check for changes since a timestamp

Examples:
  term wish read forge-resilience --section "Success Criteria"
  term wish set-status forge-resilience APPROVED --author "OpenClaw"
  term wish edit forge-resilience --section "Review Results" --content "..."
  term wish append forge-resilience --heading "## Notes" --content "Added by orchestrator"
  term wish changelog forge-resilience --since 1h`);

  // ============================================================================
  // BROWSE commands
  // ============================================================================

  // wish ls - List all wishes
  wishProgram
    .command('ls')
    .alias('list')
    .description('List all wishes and their task status')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const repoPath = process.cwd();
      const wishes = await listWishes(repoPath);

      if (options.json) {
        console.log(JSON.stringify(wishes, null, 2));
        return;
      }

      if (wishes.length === 0) {
        console.log('No wishes found in .genie/wishes/');
        return;
      }

      console.log('\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
      console.log('\u2502 WISHES                                                             \u2502');
      console.log('\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524');
      console.log('\u2502 Slug                 \u2502 Status        \u2502 Tasks (done/total)           \u2502');
      console.log('\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524');

      for (const wish of wishes) {
        const slug = wish.slug.padEnd(20).substring(0, 20);
        const status = formatWishStatus(wish.status).padEnd(13).substring(0, 13);
        const taskProgress = wish.tasks.total > 0
          ? `${wish.tasks.done}/${wish.tasks.total} (${wish.tasks.inProgress} active, ${wish.tasks.blocked} blocked)`
          : '(no tasks)';
        const tasks = taskProgress.padEnd(28).substring(0, 28);
        console.log(`\u2502 ${slug} \u2502 ${status} \u2502 ${tasks} \u2502`);
      }

      console.log('\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
    });

  // wish status <slug> - Show wish with linked tasks
  wishProgram
    .command('status <slug>')
    .description('Show wish status with linked tasks')
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { json?: boolean }) => {
      const repoPath = process.cwd();
      const wishPath = join(getWishesDir(repoPath), slug, 'wish.md');

      // Check if wish exists
      try {
        await access(wishPath);
      } catch {
        console.error(`\u274C Wish "${slug}" not found in .genie/wishes/`);
        process.exit(1);
      }

      const { title, status } = await parseWishFrontmatter(wishPath);
      const tasks = await getWishTasks(repoPath, slug);
      const taskStatus = await getWishStatus(repoPath, slug);

      if (options.json) {
        console.log(JSON.stringify({
          slug,
          title,
          status,
          tasks,
          summary: taskStatus,
        }, null, 2));
        return;
      }

      // Display wish info
      console.log(`\n\uD83D\uDCCB ${title}`);
      console.log(`   Slug: ${slug}`);
      console.log(`   Status: ${formatWishStatus(status)}`);
      console.log('');

      // Display task breakdown
      if (tasks.length === 0) {
        console.log('   No linked tasks. Use "term task link <wish-slug> <task-id>" to link.');
      } else {
        console.log(`   Tasks: ${taskStatus.done}/${taskStatus.total} done`);
        if (taskStatus.inProgress > 0) console.log(`          ${taskStatus.inProgress} in progress`);
        if (taskStatus.blocked > 0) console.log(`          ${taskStatus.blocked} blocked`);
        if (taskStatus.open > 0) console.log(`          ${taskStatus.open} open`);
        console.log('');

        console.log('   \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
        console.log('   \u2502 Task ID    \u2502 Title                                \u2502 Status   \u2502');
        console.log('   \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524');

        for (const task of tasks) {
          const taskId = task.id.padEnd(10).substring(0, 10);
          const taskTitle = task.title.padEnd(36).substring(0, 36);
          const taskState = `${formatTaskStatus(task.status)} ${task.status}`.padEnd(8).substring(0, 8);
          console.log(`   \u2502 ${taskId} \u2502 ${taskTitle} \u2502 ${taskState} \u2502`);
        }

        console.log('   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
      }

      console.log('');
    });

  // wish show <slug> - Alias for status
  wishProgram
    .command('show <slug>')
    .description('Alias for "wish status"')
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { json?: boolean }) => {
      // Delegate to status command
      const statusCmd = wishProgram.commands.find(c => c.name() === 'status');
      if (statusCmd) {
        await statusCmd.parseAsync([slug, ...(options.json ? ['--json'] : [])], { from: 'user' });
      }
    });

  // ============================================================================
  // READ / INSPECT commands
  // ============================================================================

  // wish read <slug> - Read wish document (entire or specific section)
  wishProgram
    .command('read <slug>')
    .description('Read wish document content (full or specific section)')
    .option('-s, --section <name>', 'Read only a specific section (partial match)')
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { section?: string; json?: boolean }) => {
      const repoPath = process.cwd();
      const doc = await readWish(repoPath, slug);

      if (!doc) {
        console.error(`\u274C Wish "${slug}" not found in .genie/wishes/`);
        process.exit(1);
      }

      if (options.section) {
        const section = findSection(doc, options.section);
        if (!section) {
          console.error(`\u274C Section "${options.section}" not found in wish "${slug}".`);
          console.error(`Available sections: ${doc.sections.map(s => s.heading).join(', ')}`);
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({
            slug,
            section: section.heading,
            level: section.level,
            content: section.content,
            lineRange: { start: section.startLine, end: section.endLine },
          }, null, 2));
        } else {
          console.log(section.content);
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify({
            slug,
            path: doc.path,
            sections: doc.sections.map(s => s.heading),
            content: doc.raw,
          }, null, 2));
        } else {
          console.log(doc.raw);
        }
      }
    });

  // wish sections <slug> - List all sections
  wishProgram
    .command('sections <slug>')
    .description('List all sections in a wish document')
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { json?: boolean }) => {
      const repoPath = process.cwd();
      const doc = await readWish(repoPath, slug);

      if (!doc) {
        console.error(`\u274C Wish "${slug}" not found`);
        process.exit(1);
      }

      const sections = listSections(doc);

      if (options.json) {
        console.log(JSON.stringify(sections, null, 2));
        return;
      }

      console.log(`\nSections in wish "${slug}":\n`);
      for (const section of sections) {
        const indent = '  '.repeat(section.level - 1);
        const prefix = '#'.repeat(section.level);
        console.log(`${indent}${prefix} ${section.heading}  (${section.lineCount} lines)`);
      }
      console.log('');
    });

  // ============================================================================
  // COLLABORATIVE EDITING commands
  // ============================================================================

  // wish edit <slug> - Replace a section
  wishProgram
    .command('edit <slug>')
    .description('Replace a section in a wish document')
    .requiredOption('-s, --section <name>', 'Section heading to replace (partial match)')
    .requiredOption('-c, --content <text>', 'New content for the section (use @file to read from file)')
    .option('-a, --author <name>', 'Author of the edit (default: env GENIE_AUTHOR or USER)')
    .option('-m, --message <text>', 'Edit summary message')
    .option('--json', 'Output result as JSON')
    .action(async (slug: string, options: {
      section: string;
      content: string;
      author?: string;
      message?: string;
      json?: boolean;
    }) => {
      const repoPath = process.cwd();
      const author = options.author || getAuthorName();

      // Support @file syntax for content
      let content = options.content;
      if (content.startsWith('@') && content.length > 1) {
        const filePath = content.substring(1);
        try {
          content = await readFile(filePath, 'utf-8');
        } catch (error: any) {
          console.error(`\u274C Cannot read content from file "${filePath}": ${error.message}`);
          process.exit(1);
        }
      }

      const edit: WishEdit = {
        type: 'replace_section',
        section: options.section,
        content,
      };

      const summary = options.message || `Replace section "${options.section}"`;
      const result = await editWish(repoPath, slug, edit, author, summary);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`\u2705 Section "${options.section}" updated in wish "${slug}"`);
        console.log(`   Author: ${author}`);
        if (result.changelogEntry) {
          console.log(`   Logged: ${result.changelogEntry.timestamp}`);
        }
      } else {
        console.error(`\u274C Edit failed: ${result.error}`);
        process.exit(1);
      }
    });

  // wish set-status <slug> <status> - Update wish status
  wishProgram
    .command('set-status <slug> <status>')
    .description('Update the **Status:** field in a wish document')
    .option('-a, --author <name>', 'Author of the change')
    .option('-m, --message <text>', 'Change summary')
    .option('--json', 'Output result as JSON')
    .action(async (slug: string, status: string, options: {
      author?: string;
      message?: string;
      json?: boolean;
    }) => {
      const repoPath = process.cwd();
      const author = options.author || getAuthorName();

      const edit: WishEdit = {
        type: 'update_field',
        field: 'Status',
        content: status.toUpperCase(),
      };

      const summary = options.message || `Status changed to ${status.toUpperCase()}`;
      const result = await editWish(repoPath, slug, edit, author, summary);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`\u2705 Status updated: ${formatWishStatus(status.toUpperCase())}`);
        console.log(`   Wish: ${slug}`);
        console.log(`   Author: ${author}`);
      } else {
        console.error(`\u274C Failed: ${result.error}`);
        process.exit(1);
      }
    });

  // wish append <slug> - Append a new section
  wishProgram
    .command('append <slug>')
    .description('Append a new section to a wish document')
    .requiredOption('-c, --content <text>', 'Content to append (use @file to read from file)')
    .option('-h, --heading <text>', 'Section heading (e.g., "## Review Results")')
    .option('-a, --author <name>', 'Author of the change')
    .option('-m, --message <text>', 'Change summary')
    .option('--after <section>', 'Insert after this section (instead of at end)')
    .option('--json', 'Output result as JSON')
    .action(async (slug: string, options: {
      content: string;
      heading?: string;
      author?: string;
      message?: string;
      after?: string;
      json?: boolean;
    }) => {
      const repoPath = process.cwd();
      const author = options.author || getAuthorName();

      // Support @file syntax
      let content = options.content;
      if (content.startsWith('@') && content.length > 1) {
        const filePath = content.substring(1);
        try {
          content = await readFile(filePath, 'utf-8');
        } catch (error: any) {
          console.error(`\u274C Cannot read content from file "${filePath}": ${error.message}`);
          process.exit(1);
        }
      }

      // Prepend heading if provided
      if (options.heading) {
        content = `${options.heading}\n\n${content}`;
      }

      let edit: WishEdit;
      if (options.after) {
        edit = {
          type: 'insert_after',
          afterSection: options.after,
          content,
          section: options.heading?.replace(/^#+\s*/, ''),
        };
      } else {
        edit = {
          type: 'append_section',
          section: options.heading?.replace(/^#+\s*/, ''),
          content,
        };
      }

      const summary = options.message || `Append section${options.heading ? `: ${options.heading}` : ''}`;
      const result = await editWish(repoPath, slug, edit, author, summary);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`\u2705 Content appended to wish "${slug}"`);
        console.log(`   Author: ${author}`);
        if (result.changelogEntry) {
          console.log(`   Logged: ${result.changelogEntry.timestamp}`);
        }
      } else {
        console.error(`\u274C Append failed: ${result.error}`);
        process.exit(1);
      }
    });

  // wish set-field <slug> <field> - Update any **Field:** value
  wishProgram
    .command('set-field <slug> <field>')
    .description('Update any **Field:** value in a wish document (e.g., Author, Priority)')
    .requiredOption('-v, --value <text>', 'New value for the field')
    .option('-a, --author <name>', 'Author of the change')
    .option('-m, --message <text>', 'Change summary')
    .option('--json', 'Output result as JSON')
    .action(async (slug: string, field: string, options: {
      value: string;
      author?: string;
      message?: string;
      json?: boolean;
    }) => {
      const repoPath = process.cwd();
      const author = options.author || getAuthorName();

      const edit: WishEdit = {
        type: 'update_field',
        field,
        content: options.value,
      };

      const summary = options.message || `Updated ${field} to "${options.value}"`;
      const result = await editWish(repoPath, slug, edit, author, summary);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`\u2705 Field "${field}" updated to "${options.value}"`);
        console.log(`   Wish: ${slug}`);
        console.log(`   Author: ${author}`);
      } else {
        console.error(`\u274C Failed: ${result.error}`);
        process.exit(1);
      }
    });

  // ============================================================================
  // HISTORY commands
  // ============================================================================

  // wish changelog <slug> - View edit history
  wishProgram
    .command('changelog <slug>')
    .description('View edit history (changelog) for a wish')
    .option('--since <duration>', 'Show entries since duration (e.g., 1h, 30m, 2d)')
    .option('-n, --last <count>', 'Show last N entries', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { since?: string; last?: number; json?: boolean }) => {
      const repoPath = process.cwd();

      if (!await wishExists(repoPath, slug)) {
        console.error(`\u274C Wish "${slug}" not found`);
        process.exit(1);
      }

      let entries = await readChangelog(repoPath, slug);

      // Filter by --since
      if (options.since) {
        const sinceMs = parseDuration(options.since);
        if (sinceMs) {
          const cutoff = Date.now() - sinceMs;
          entries = entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
        }
      }

      // Limit by --last
      if (options.last && options.last > 0) {
        entries = entries.slice(-options.last);
      }

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log(`No changelog entries for wish "${slug}".`);
        console.log('Changelog tracks edits made via "term wish edit/set-status/append".');
        return;
      }

      console.log(`\nChangelog for wish "${slug}" (${entries.length} entries):\n`);
      for (const entry of entries) {
        console.log(formatChangelogEntry(entry));
        console.log('');
      }
    });

  // wish diff <slug> - Check for changes since timestamp
  wishProgram
    .command('diff <slug>')
    .description('Check if wish has been modified since a timestamp')
    .option('--since <duration>', 'Check for changes since duration (e.g., 1h, 30m)')
    .option('--since-ms <timestamp>', 'Check since epoch milliseconds', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (slug: string, options: { since?: string; sinceMs?: number; json?: boolean }) => {
      const repoPath = process.cwd();

      if (!await wishExists(repoPath, slug)) {
        console.error(`\u274C Wish "${slug}" not found`);
        process.exit(1);
      }

      let sinceMs: number;
      if (options.sinceMs) {
        sinceMs = options.sinceMs;
      } else if (options.since) {
        const duration = parseDuration(options.since);
        sinceMs = duration ? Date.now() - duration : Date.now() - 3600000; // default 1h
      } else {
        sinceMs = Date.now() - 3600000; // default: 1 hour ago
      }

      const result = await hasChanges(repoPath, slug, sinceMs);

      if (options.json) {
        console.log(JSON.stringify({
          slug,
          changed: result.changed,
          sinceMs,
          sinceIso: new Date(sinceMs).toISOString(),
          entryCount: result.entries.length,
          entries: result.entries,
        }, null, 2));
        return;
      }

      if (result.changed) {
        console.log(`\uD83D\uDD04 Wish "${slug}" has ${result.entries.length} change(s) since ${new Date(sinceMs).toLocaleString()}:`);
        for (const entry of result.entries) {
          console.log(formatChangelogEntry(entry));
          console.log('');
        }
      } else {
        console.log(`\u2705 No changes to wish "${slug}" since ${new Date(sinceMs).toLocaleString()}.`);
      }
    });
}

// ============================================================================
// Duration Parsing
// ============================================================================

/**
 * Parse a duration string like "1h", "30m", "2d" into milliseconds
 */
function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}
