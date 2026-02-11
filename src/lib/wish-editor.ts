/**
 * Wish Editor - Read-only wish document parsing
 *
 * Enables agents to read and inspect wish documents by section.
 * File-based, works across processes, no HTTP needed.
 *
 * Design principles:
 *   - Read-only (edits use filesystem directly)
 *   - Section-level parsing by markdown headings
 *   - Partial-match section lookup
 */

import { readFile, readdir, access, stat } from 'fs/promises';
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
  /** File modification time */
  mtime: number;
  /** File path */
  path: string;
}

/**
 * A section in a wish document (delimited by headings)
 */
export interface WishSection {
  /** Section heading (without #) */
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

// ============================================================================
// Path Utilities
// ============================================================================

export function getWishPath(repoPath: string, slug: string): string {
  return join(repoPath, '.genie', 'wishes', slug, 'wish.md');
}

export function getWishDir(repoPath: string, slug: string): string {
  return join(repoPath, '.genie', 'wishes', slug);
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse markdown content into sections by headings.
 * Handles # through #### levels. Code blocks with # are ignored.
 */
export function parseSections(content: string): WishSection[] {
  const lines = content.split('\n');
  const sections: WishSection[] = [];
  let currentSection: Partial<WishSection> | null = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code fences to avoid matching # inside code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

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

  // Partial match
  const partial = document.sections.find(s => s.heading.toLowerCase().includes(lower));
  return partial || null;
}

/**
 * List all section headings
 */
export function listSections(document: WishDocument): Array<{ heading: string; level: number; lineCount: number }> {
  return document.sections.map(s => ({
    heading: s.heading,
    level: s.level,
    lineCount: s.endLine - s.startLine,
  }));
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
