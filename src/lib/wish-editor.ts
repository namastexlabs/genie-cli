/**
 * Wish Editor - Collaborative wish document editing
 *
 * Enables external agents (OpenClaw, orchestrators, other Claude sessions)
 * to safely read and edit wish documents written by Claude Code workers.
 *
 * Protocol:
 *   1. Read wish document → get current content
 *   2. Propose edit → specify section + new content
 *   3. Edit recorded in changelog → .genie/wishes/<slug>/changelog.jsonl
 *   4. Workers detect changes via changelog mtime or polling
 *
 * Design principles:
 *   - File-based (works across processes, no HTTP needed)
 *   - Section-level edits (not line-level, avoids merge conflicts)
 *   - Changelog for audit trail and conflict detection
 *   - Lock-free (optimistic concurrency via version tracking)
 */

import { readFile, writeFile, mkdir, access, appendFile, stat } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a parsed wish document with sections
 */
export interface WishDocument {
  /** Raw markdown content */
  raw: string;
  /** Wish slug */
  slug: string;
  /** Parsed sections (keyed by heading text) */
  sections: WishSection[];
  /** File modification time (for optimistic concurrency) */
  mtime: number;
  /** File path */
  path: string;
}

/**
 * A section in a wish document (delimited by ## headings)
 */
export interface WishSection {
  /** Section heading (without ##) */
  heading: string;
  /** Section content (including the heading line) */
  content: string;
  /** Line offset in the document */
  startLine: number;
  /** End line (exclusive) */
  endLine: number;
  /** Nesting level (1 = #, 2 = ##, 3 = ###) */
  level: number;
}

/**
 * An edit operation on a wish document
 */
export interface WishEdit {
  /** Type of edit */
  type: 'replace_section' | 'append_section' | 'insert_after' | 'replace_content' | 'update_field';
  /** Target section heading (for section-level edits) */
  section?: string;
  /** New content to write */
  content: string;
  /** For insert_after: insert after this section */
  afterSection?: string;
  /** For update_field: field name in frontmatter-style lines (e.g., "Status") */
  field?: string;
}

/**
 * A changelog entry recording who edited what
 */
export interface ChangelogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Who made the edit (agent name, session ID, etc.) */
  author: string;
  /** What kind of edit */
  editType: WishEdit['type'];
  /** Which section was affected */
  section?: string;
  /** Brief description of the change */
  summary: string;
  /** Previous content hash (for conflict detection) */
  previousHash?: string;
  /** New content hash */
  newHash?: string;
}

/**
 * Result of an edit operation
 */
export interface EditResult {
  /** Whether the edit was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The updated document */
  document?: WishDocument;
  /** The changelog entry that was created */
  changelogEntry?: ChangelogEntry;
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get the wish document path
 */
export function getWishPath(repoPath: string, slug: string): string {
  return join(repoPath, '.genie', 'wishes', slug, 'wish.md');
}

/**
 * Get the changelog path for a wish
 */
export function getChangelogPath(repoPath: string, slug: string): string {
  return join(repoPath, '.genie', 'wishes', slug, 'changelog.jsonl');
}

/**
 * Get the wish directory
 */
export function getWishDir(repoPath: string, slug: string): string {
  return join(repoPath, '.genie', 'wishes', slug);
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a wish document into sections
 */
export function parseSections(content: string): WishSection[] {
  const lines = content.split('\n');
  const sections: WishSection[] = [];
  let currentSection: Partial<WishSection> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      // Close previous section
      if (currentSection) {
        currentSection.endLine = i;
        currentSection.content = lines.slice(currentSection.startLine!, i).join('\n');
        sections.push(currentSection as WishSection);
      }

      // Start new section
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        startLine: i,
      };
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length;
    currentSection.content = lines.slice(currentSection.startLine!).join('\n');
    sections.push(currentSection as WishSection);
  }

  return sections;
}

/**
 * Read and parse a wish document
 */
export async function readWish(repoPath: string, slug: string): Promise<WishDocument | null> {
  const wishPath = getWishPath(repoPath, slug);

  try {
    const [content, fileStat] = await Promise.all([
      readFile(wishPath, 'utf-8'),
      stat(wishPath),
    ]);

    return {
      raw: content,
      slug,
      sections: parseSections(content),
      mtime: fileStat.mtimeMs,
      path: wishPath,
    };
  } catch {
    return null;
  }
}

/**
 * Find a section by heading (case-insensitive, partial match)
 */
export function findSection(document: WishDocument, heading: string): WishSection | null {
  const lower = heading.toLowerCase();

  // Exact match first
  const exact = document.sections.find(s => s.heading.toLowerCase() === lower);
  if (exact) return exact;

  // Partial match (heading contains search term)
  const partial = document.sections.find(s => s.heading.toLowerCase().includes(lower));
  return partial || null;
}

/**
 * List all section headings in a wish document
 */
export function listSections(document: WishDocument): Array<{ heading: string; level: number; lineCount: number }> {
  return document.sections.map(s => ({
    heading: s.heading,
    level: s.level,
    lineCount: s.endLine - s.startLine,
  }));
}

// ============================================================================
// Simple content hash for conflict detection
// ============================================================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Edit Operations
// ============================================================================

/**
 * Apply an edit to a wish document
 *
 * @param repoPath - Repository root path
 * @param slug - Wish slug
 * @param edit - The edit to apply
 * @param author - Who is making the edit
 * @param summary - Brief description of the change
 * @returns Edit result
 */
export async function editWish(
  repoPath: string,
  slug: string,
  edit: WishEdit,
  author: string,
  summary: string
): Promise<EditResult> {
  // Read current document
  const doc = await readWish(repoPath, slug);
  if (!doc) {
    return { success: false, error: `Wish "${slug}" not found` };
  }

  const lines = doc.raw.split('\n');
  let newContent: string;
  let sectionName = edit.section;

  try {
    switch (edit.type) {
      case 'replace_section': {
        if (!edit.section) {
          return { success: false, error: 'section is required for replace_section' };
        }
        const section = findSection(doc, edit.section);
        if (!section) {
          return { success: false, error: `Section "${edit.section}" not found. Available: ${doc.sections.map(s => s.heading).join(', ')}` };
        }
        sectionName = section.heading;

        // Replace the section content
        const before = lines.slice(0, section.startLine);
        const after = lines.slice(section.endLine);
        newContent = [...before, edit.content, ...after].join('\n');
        break;
      }

      case 'append_section': {
        // Append a new section at the end of the document
        newContent = doc.raw.trimEnd() + '\n\n' + edit.content + '\n';
        sectionName = edit.section || '(appended)';
        break;
      }

      case 'insert_after': {
        if (!edit.afterSection) {
          return { success: false, error: 'afterSection is required for insert_after' };
        }
        const afterSec = findSection(doc, edit.afterSection);
        if (!afterSec) {
          return { success: false, error: `Section "${edit.afterSection}" not found` };
        }

        const beforeInsert = lines.slice(0, afterSec.endLine);
        const afterInsert = lines.slice(afterSec.endLine);
        newContent = [...beforeInsert, '', edit.content, ...afterInsert].join('\n');
        sectionName = edit.section || `(after ${afterSec.heading})`;
        break;
      }

      case 'replace_content': {
        // Replace the entire document content
        newContent = edit.content;
        sectionName = '(entire document)';
        break;
      }

      case 'update_field': {
        if (!edit.field) {
          return { success: false, error: 'field is required for update_field' };
        }

        // Find and update a frontmatter-style field like **Status:** DRAFT
        const fieldPattern = new RegExp(
          `^(\\*\\*${escapeRegExp(edit.field)}:\\*\\*\\s*)(.+)$`,
          'im'
        );
        const match = doc.raw.match(fieldPattern);

        if (match) {
          newContent = doc.raw.replace(fieldPattern, `$1${edit.content}`);
        } else {
          return {
            success: false,
            error: `Field "${edit.field}" not found in document. ` +
              `Expected format: **${edit.field}:** value`,
          };
        }
        sectionName = `field:${edit.field}`;
        break;
      }

      default:
        return { success: false, error: `Unknown edit type: ${edit.type}` };
    }

    // Write updated content
    const wishPath = getWishPath(repoPath, slug);
    await writeFile(wishPath, newContent);

    // Create changelog entry
    const changelogEntry: ChangelogEntry = {
      timestamp: new Date().toISOString(),
      author,
      editType: edit.type,
      section: sectionName,
      summary,
      previousHash: simpleHash(doc.raw),
      newHash: simpleHash(newContent),
    };

    await appendChangelog(repoPath, slug, changelogEntry);

    // Re-read the updated document
    const updatedDoc = await readWish(repoPath, slug);

    return {
      success: true,
      document: updatedDoc || undefined,
      changelogEntry,
    };
  } catch (error: any) {
    return { success: false, error: `Edit failed: ${error.message}` };
  }
}

// ============================================================================
// Changelog
// ============================================================================

/**
 * Append an entry to the wish changelog
 */
async function appendChangelog(
  repoPath: string,
  slug: string,
  entry: ChangelogEntry
): Promise<void> {
  const changelogPath = getChangelogPath(repoPath, slug);
  const dir = getWishDir(repoPath, slug);

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Append as JSONL
  const line = JSON.stringify(entry) + '\n';
  await appendFile(changelogPath, line);
}

/**
 * Read the changelog for a wish
 */
export async function readChangelog(
  repoPath: string,
  slug: string
): Promise<ChangelogEntry[]> {
  const changelogPath = getChangelogPath(repoPath, slug);

  try {
    const content = await readFile(changelogPath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as ChangelogEntry);
  } catch {
    return [];
  }
}

/**
 * Check if a wish has been modified since a given timestamp
 */
export async function hasChanges(
  repoPath: string,
  slug: string,
  sinceMs: number
): Promise<{ changed: boolean; entries: ChangelogEntry[] }> {
  const entries = await readChangelog(repoPath, slug);
  const recentEntries = entries.filter(e => new Date(e.timestamp).getTime() > sinceMs);

  return {
    changed: recentEntries.length > 0,
    entries: recentEntries,
  };
}

/**
 * Get the last modification info for a wish
 */
export async function getLastModification(
  repoPath: string,
  slug: string
): Promise<ChangelogEntry | null> {
  const entries = await readChangelog(repoPath, slug);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a wish exists
 */
export async function wishExists(repoPath: string, slug: string): Promise<boolean> {
  try {
    await access(getWishPath(repoPath, slug));
    return true;
  } catch {
    return false;
  }
}

/**
 * List all wish slugs in a repository
 */
export async function listWishSlugs(repoPath: string): Promise<string[]> {
  const wishesDir = join(repoPath, '.genie', 'wishes');

  try {
    const { readdir } = await import('fs/promises');
    const entries = await readdir(wishesDir, { withFileTypes: true });
    const slugs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          await access(join(wishesDir, entry.name, 'wish.md'));
          slugs.push(entry.name);
        } catch {
          // No wish.md in this directory
        }
      }
    }

    return slugs.sort();
  } catch {
    return [];
  }
}
