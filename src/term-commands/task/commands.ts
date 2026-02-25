/**
 * Task Namespace — Dependency-aware task management.
 *
 * Commands:
 *   genie task create <title>
 *   genie task list
 *   genie task update <id> --status <status>
 *
 * Group F: Tasks differentiate "ready" vs "blocked" based on
 * dependency resolution.
 */

import { Command } from 'commander';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'ready' | 'in_progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  blockedBy: string[];
  createdAt: string;
  updatedAt: string;
}

interface TasksFile {
  tasks: Record<string, Task>;
  order: string[];
  nextId: number;
  lastUpdated: string;
}

// ============================================================================
// Persistence
// ============================================================================

function tasksFilePath(repoPath: string): string {
  return join(repoPath, '.genie', 'tasks.json');
}

async function loadTasks(repoPath: string): Promise<TasksFile> {
  try {
    const content = await readFile(tasksFilePath(repoPath), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { tasks: {}, order: [], nextId: 1, lastUpdated: new Date().toISOString() };
  }
}

async function saveTasks(repoPath: string, data: TasksFile): Promise<void> {
  await mkdir(join(repoPath, '.genie'), { recursive: true });
  data.lastUpdated = new Date().toISOString();
  await writeFile(tasksFilePath(repoPath), JSON.stringify(data, null, 2));
}

// ============================================================================
// Task Logic
// ============================================================================

function resolveStatus(task: Task, allTasks: Record<string, Task>): 'ready' | 'blocked' {
  if (task.status === 'done' || task.status === 'in_progress') {
    return task.status as any;
  }
  if (task.blockedBy.length === 0) return 'ready';
  const allDone = task.blockedBy.every(id => allTasks[id]?.status === 'done');
  return allDone ? 'ready' : 'blocked';
}

// ============================================================================
// Register namespace
// ============================================================================

export function registerTaskNamespace(program: Command): void {
  const task = program
    .command('task')
    .description('Dependency-aware task management');

  // task create
  task
    .command('create <title>')
    .description('Create a new task')
    .option('-d, --description <text>', 'Task description')
    .option('--blocked-by <ids>', 'Comma-separated task IDs this depends on')
    .action(async (title: string, options: { description?: string; blockedBy?: string }) => {
      try {
        const repoPath = process.cwd();
        const data = await loadTasks(repoPath);
        const id = `task-${data.nextId}`;
        data.nextId += 1;

        const blockedBy = options.blockedBy
          ? options.blockedBy.split(',').map(s => s.trim())
          : [];

        const now = new Date().toISOString();
        const newTask: Task = {
          id,
          title,
          description: options.description,
          status: blockedBy.length > 0 ? 'blocked' : 'ready',
          blockedBy,
          createdAt: now,
          updatedAt: now,
        };

        data.tasks[id] = newTask;
        data.order.push(id);
        await saveTasks(repoPath, data);

        console.log(`Task created: ${id}`);
        console.log(`  Title: ${title}`);
        console.log(`  Status: ${newTask.status}`);
        if (blockedBy.length > 0) {
          console.log(`  Blocked by: ${blockedBy.join(', ')}`);
        }
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // task list
  task
    .command('list')
    .alias('ls')
    .description('List tasks with ready/blocked differentiation')
    .option('--json', 'Output as JSON')
    .option('--all', 'Include done tasks')
    .action(async (options: { json?: boolean; all?: boolean }) => {
      try {
        const repoPath = process.cwd();
        const data = await loadTasks(repoPath);
        const allTasks = data.tasks;

        const tasks = data.order
          .map(id => allTasks[id])
          .filter(Boolean)
          .filter(t => options.all || t.status !== 'done')
          .map(t => ({
            ...t,
            effectiveStatus: resolveStatus(t, allTasks),
          }));

        if (options.json) {
          console.log(JSON.stringify(tasks, null, 2));
          return;
        }

        if (tasks.length === 0) {
          console.log('No tasks found. Create one: genie task create "My task"');
          return;
        }

        const ready = tasks.filter(t => t.effectiveStatus === 'ready');
        const blocked = tasks.filter(t => t.effectiveStatus === 'blocked');
        const inProgress = tasks.filter(t => t.status === 'in_progress');

        console.log('');
        console.log('TASKS');
        console.log('='.repeat(60));

        if (inProgress.length > 0) {
          console.log('\nIn Progress:');
          for (const t of inProgress) {
            console.log(`  ${t.id}: ${t.title}`);
          }
        }

        if (ready.length > 0) {
          console.log('\nReady:');
          for (const t of ready) {
            console.log(`  ${t.id}: ${t.title}`);
          }
        }

        if (blocked.length > 0) {
          console.log('\nBlocked:');
          for (const t of blocked) {
            console.log(`  ${t.id}: ${t.title} (blocked by: ${t.blockedBy.join(', ')})`);
          }
        }

        console.log('');
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  // task update
  task
    .command('update <id>')
    .description('Update task properties')
    .option('--status <status>', 'New status: ready, in_progress, done, blocked')
    .option('--title <title>', 'New title')
    .option('--blocked-by <ids>', 'Set blocked-by list (comma-separated)')
    .action(async (id: string, options: { status?: string; title?: string; blockedBy?: string }) => {
      try {
        const repoPath = process.cwd();
        const data = await loadTasks(repoPath);
        const task = data.tasks[id];

        if (!task) {
          console.error(`Task "${id}" not found.`);
          process.exit(1);
        }

        if (options.status) {
          task.status = options.status as TaskStatus;
        }
        if (options.title) {
          task.title = options.title;
        }
        if (options.blockedBy !== undefined) {
          task.blockedBy = options.blockedBy
            ? options.blockedBy.split(',').map(s => s.trim())
            : [];
        }

        task.updatedAt = new Date().toISOString();
        await saveTasks(repoPath, data);

        console.log(`Task "${id}" updated.`);
        console.log(`  Status: ${task.status}`);
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });
}
