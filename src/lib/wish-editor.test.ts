/**
 * Tests for the wish-editor module — collaborative wish document editing
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseSections,
  readWish,
  editWish,
  readChangelog,
  hasChanges,
  getLastModification,
  findSection,
  listSections,
  wishExists,
  listWishSlugs,
  getWishPath,
  getChangelogPath,
} from './wish-editor.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_WISH = `# Wish: Test Feature

**Status:** DRAFT
**Slug:** test-feature
**Created:** 2026-02-11
**Author:** TestBot

---

## Summary

This is a test wish document for collaborative editing tests.

## Scope

### IN
- Item 1
- Item 2

### OUT
- Not this

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Notes

Some notes here.
`;

// ============================================================================
// Setup / Teardown
// ============================================================================

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'wish-editor-test-'));
  const wishDir = join(tmpDir, '.genie', 'wishes', 'test-feature');
  await mkdir(wishDir, { recursive: true });
  await writeFile(join(wishDir, 'wish.md'), SAMPLE_WISH);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// parseSections
// ============================================================================

describe('parseSections', () => {
  it('should parse all sections from a wish document', () => {
    const sections = parseSections(SAMPLE_WISH);
    const headings = sections.map(s => s.heading);

    expect(headings).toContain('Wish: Test Feature');
    expect(headings).toContain('Summary');
    expect(headings).toContain('Scope');
    expect(headings).toContain('IN');
    expect(headings).toContain('OUT');
    expect(headings).toContain('Success Criteria');
    expect(headings).toContain('Notes');
  });

  it('should detect heading levels correctly', () => {
    const sections = parseSections(SAMPLE_WISH);

    const h1 = sections.find(s => s.heading === 'Wish: Test Feature');
    expect(h1?.level).toBe(1);

    const h2 = sections.find(s => s.heading === 'Summary');
    expect(h2?.level).toBe(2);

    const h3 = sections.find(s => s.heading === 'IN');
    expect(h3?.level).toBe(3);
  });

  it('should set correct line ranges', () => {
    const sections = parseSections(SAMPLE_WISH);
    const summary = sections.find(s => s.heading === 'Summary');

    expect(summary).toBeDefined();
    expect(summary!.startLine).toBeGreaterThan(0);
    expect(summary!.endLine).toBeGreaterThan(summary!.startLine);
    expect(summary!.content).toContain('This is a test wish document');
  });

  it('should handle empty content', () => {
    const sections = parseSections('');
    expect(sections).toEqual([]);
  });

  it('should handle content with no headings', () => {
    const sections = parseSections('Just some text\nwith no headings');
    expect(sections).toEqual([]);
  });
});

// ============================================================================
// readWish
// ============================================================================

describe('readWish', () => {
  it('should read and parse a wish document', async () => {
    const doc = await readWish(tmpDir, 'test-feature');

    expect(doc).not.toBeNull();
    expect(doc!.slug).toBe('test-feature');
    expect(doc!.raw).toContain('# Wish: Test Feature');
    expect(doc!.sections.length).toBeGreaterThan(0);
    expect(doc!.mtime).toBeGreaterThan(0);
  });

  it('should return null for non-existent wish', async () => {
    const doc = await readWish(tmpDir, 'does-not-exist');
    expect(doc).toBeNull();
  });
});

// ============================================================================
// findSection
// ============================================================================

describe('findSection', () => {
  it('should find section by exact match', async () => {
    const doc = await readWish(tmpDir, 'test-feature');
    const section = findSection(doc!, 'Summary');

    expect(section).not.toBeNull();
    expect(section!.heading).toBe('Summary');
  });

  it('should find section by partial match', async () => {
    const doc = await readWish(tmpDir, 'test-feature');
    const section = findSection(doc!, 'success');

    expect(section).not.toBeNull();
    expect(section!.heading).toBe('Success Criteria');
  });

  it('should be case-insensitive', async () => {
    const doc = await readWish(tmpDir, 'test-feature');
    const section = findSection(doc!, 'SUMMARY');

    expect(section).not.toBeNull();
    expect(section!.heading).toBe('Summary');
  });

  it('should return null for non-existent section', async () => {
    const doc = await readWish(tmpDir, 'test-feature');
    const section = findSection(doc!, 'Nonexistent Section');

    expect(section).toBeNull();
  });
});

// ============================================================================
// listSections
// ============================================================================

describe('listSections', () => {
  it('should list all sections with metadata', async () => {
    const doc = await readWish(tmpDir, 'test-feature');
    const sections = listSections(doc!);

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0]).toHaveProperty('heading');
    expect(sections[0]).toHaveProperty('level');
    expect(sections[0]).toHaveProperty('lineCount');
  });
});

// ============================================================================
// editWish - replace_section
// ============================================================================

describe('editWish - replace_section', () => {
  it('should replace a section content', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'replace_section',
        section: 'Notes',
        content: '## Notes\n\nUpdated notes from external agent.',
      },
      'OpenClaw',
      'Updated notes section'
    );

    expect(result.success).toBe(true);
    expect(result.changelogEntry).toBeDefined();
    expect(result.changelogEntry!.author).toBe('OpenClaw');

    // Verify the file was updated
    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(updated).toContain('Updated notes from external agent.');
    expect(updated).not.toContain('Some notes here.');
  });

  it('should fail for non-existent section', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'replace_section',
        section: 'Nonexistent',
        content: 'new content',
      },
      'TestAgent',
      'test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should fail for non-existent wish', async () => {
    const result = await editWish(
      tmpDir,
      'no-such-wish',
      {
        type: 'replace_section',
        section: 'Summary',
        content: 'new content',
      },
      'TestAgent',
      'test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should require section parameter', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'replace_section',
        content: 'new content',
      },
      'TestAgent',
      'test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});

// ============================================================================
// editWish - update_field
// ============================================================================

describe('editWish - update_field', () => {
  it('should update the Status field', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'update_field',
        field: 'Status',
        content: 'APPROVED',
      },
      'OpenClaw',
      'Approved the wish'
    );

    expect(result.success).toBe(true);

    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(updated).toContain('**Status:** APPROVED');
    expect(updated).not.toContain('**Status:** DRAFT');
  });

  it('should update the Author field', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'update_field',
        field: 'Author',
        content: 'OpenClaw Orchestrator',
      },
      'OpenClaw',
      'Changed author'
    );

    expect(result.success).toBe(true);

    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(updated).toContain('**Author:** OpenClaw Orchestrator');
  });

  it('should fail for non-existent field', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'update_field',
        field: 'Priority',
        content: 'P0',
      },
      'TestAgent',
      'test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================================
// editWish - append_section
// ============================================================================

describe('editWish - append_section', () => {
  it('should append content to end of document', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'append_section',
        content: '## Review Results\n\n**Verdict:** SHIP\nAll criteria pass.',
        section: 'Review Results',
      },
      'ReviewBot',
      'Added review results'
    );

    expect(result.success).toBe(true);

    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(updated).toContain('## Review Results');
    expect(updated).toContain('**Verdict:** SHIP');
  });
});

// ============================================================================
// editWish - insert_after
// ============================================================================

describe('editWish - insert_after', () => {
  it('should insert content after a specific section', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'insert_after',
        afterSection: 'Summary',
        content: '## Decisions\n\n| # | Decision | Rationale |\n|---|----------|-----------|',
      },
      'PlannerBot',
      'Added decisions section'
    );

    expect(result.success).toBe(true);

    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    const summaryIdx = updated.indexOf('## Summary');
    const decisionsIdx = updated.indexOf('## Decisions');
    const scopeIdx = updated.indexOf('## Scope');

    expect(decisionsIdx).toBeGreaterThan(summaryIdx);
    expect(decisionsIdx).toBeLessThan(scopeIdx);
  });

  it('should fail for non-existent afterSection', async () => {
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'insert_after',
        afterSection: 'Nonexistent',
        content: 'new content',
      },
      'TestAgent',
      'test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================================
// editWish - replace_content
// ============================================================================

describe('editWish - replace_content', () => {
  it('should replace entire document content', async () => {
    const newContent = '# Wish: Completely New\n\n**Status:** APPROVED\n\nNew content.\n';
    const result = await editWish(
      tmpDir,
      'test-feature',
      {
        type: 'replace_content',
        content: newContent,
      },
      'Rewriter',
      'Complete rewrite'
    );

    expect(result.success).toBe(true);

    const updated = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(updated).toBe(newContent);
  });
});

// ============================================================================
// Changelog
// ============================================================================

describe('changelog', () => {
  it('should create changelog entries on edit', async () => {
    await editWish(
      tmpDir,
      'test-feature',
      { type: 'update_field', field: 'Status', content: 'APPROVED' },
      'Agent1',
      'First edit'
    );

    await editWish(
      tmpDir,
      'test-feature',
      { type: 'update_field', field: 'Status', content: 'IN_PROGRESS' },
      'Agent2',
      'Second edit'
    );

    const entries = await readChangelog(tmpDir, 'test-feature');
    expect(entries.length).toBe(2);
    expect(entries[0].author).toBe('Agent1');
    expect(entries[0].summary).toBe('First edit');
    expect(entries[1].author).toBe('Agent2');
    expect(entries[1].summary).toBe('Second edit');
  });

  it('should return empty array for wish with no changelog', async () => {
    const entries = await readChangelog(tmpDir, 'test-feature');
    expect(entries).toEqual([]);
  });

  it('should detect changes since timestamp', async () => {
    const beforeEdit = Date.now();

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    await editWish(
      tmpDir,
      'test-feature',
      { type: 'update_field', field: 'Status', content: 'APPROVED' },
      'Agent1',
      'Status change'
    );

    const result = await hasChanges(tmpDir, 'test-feature', beforeEdit);
    expect(result.changed).toBe(true);
    expect(result.entries.length).toBe(1);
  });

  it('should report no changes when nothing changed', async () => {
    const result = await hasChanges(tmpDir, 'test-feature', Date.now());
    expect(result.changed).toBe(false);
    expect(result.entries.length).toBe(0);
  });
});

// ============================================================================
// getLastModification
// ============================================================================

describe('getLastModification', () => {
  it('should return last changelog entry', async () => {
    await editWish(
      tmpDir,
      'test-feature',
      { type: 'update_field', field: 'Status', content: 'APPROVED' },
      'Agent1',
      'First'
    );
    await editWish(
      tmpDir,
      'test-feature',
      { type: 'update_field', field: 'Status', content: 'DONE' },
      'Agent2',
      'Second'
    );

    const last = await getLastModification(tmpDir, 'test-feature');
    expect(last).not.toBeNull();
    expect(last!.author).toBe('Agent2');
    expect(last!.summary).toBe('Second');
  });

  it('should return null when no changelog exists', async () => {
    const last = await getLastModification(tmpDir, 'test-feature');
    expect(last).toBeNull();
  });
});

// ============================================================================
// wishExists / listWishSlugs
// ============================================================================

describe('wishExists', () => {
  it('should return true for existing wish', async () => {
    expect(await wishExists(tmpDir, 'test-feature')).toBe(true);
  });

  it('should return false for non-existent wish', async () => {
    expect(await wishExists(tmpDir, 'nope')).toBe(false);
  });
});

describe('listWishSlugs', () => {
  it('should list all wish slugs', async () => {
    // Create a second wish
    const dir2 = join(tmpDir, '.genie', 'wishes', 'second-wish');
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir2, 'wish.md'), '# Wish: Second\n');

    const slugs = await listWishSlugs(tmpDir);
    expect(slugs).toContain('test-feature');
    expect(slugs).toContain('second-wish');
  });

  it('should skip directories without wish.md', async () => {
    const dir2 = join(tmpDir, '.genie', 'wishes', 'empty-dir');
    await mkdir(dir2, { recursive: true });

    const slugs = await listWishSlugs(tmpDir);
    expect(slugs).toContain('test-feature');
    expect(slugs).not.toContain('empty-dir');
  });

  it('should return empty array when no wishes directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'empty-'));
    const slugs = await listWishSlugs(emptyDir);
    expect(slugs).toEqual([]);
    await rm(emptyDir, { recursive: true, force: true });
  });
});

// ============================================================================
// Multi-agent editing scenario
// ============================================================================

describe('multi-agent collaborative editing', () => {
  it('should handle sequential edits from multiple agents', async () => {
    // Agent 1 (worker) updates status
    const r1 = await editWish(
      tmpDir, 'test-feature',
      { type: 'update_field', field: 'Status', content: 'IN_PROGRESS' },
      'claude-worker-1', 'Worker started implementation'
    );
    expect(r1.success).toBe(true);

    // Agent 2 (orchestrator) adds review section
    const r2 = await editWish(
      tmpDir, 'test-feature',
      {
        type: 'append_section',
        content: '## Orchestrator Notes\n\nPriority bumped. Ship by EOD.',
        section: 'Orchestrator Notes',
      },
      'OpenClaw', 'Added priority note'
    );
    expect(r2.success).toBe(true);

    // Agent 3 (reviewer) replaces success criteria
    const r3 = await editWish(
      tmpDir, 'test-feature',
      {
        type: 'replace_section',
        section: 'Success Criteria',
        content: '## Success Criteria\n\n- [x] Criterion 1\n- [x] Criterion 2\n- [ ] Criterion 3 (in progress)',
      },
      'review-agent', 'Updated criteria progress'
    );
    expect(r3.success).toBe(true);

    // Verify final state
    const final = await readFile(getWishPath(tmpDir, 'test-feature'), 'utf-8');
    expect(final).toContain('**Status:** IN_PROGRESS');
    expect(final).toContain('Orchestrator Notes');
    expect(final).toContain('Priority bumped');
    expect(final).toContain('[x] Criterion 1');

    // Verify changelog has all 3 entries
    const changelog = await readChangelog(tmpDir, 'test-feature');
    expect(changelog.length).toBe(3);
    expect(changelog.map(e => e.author)).toEqual([
      'claude-worker-1',
      'OpenClaw',
      'review-agent',
    ]);
  });

  it('should preserve content hashes for conflict detection', async () => {
    await editWish(
      tmpDir, 'test-feature',
      { type: 'update_field', field: 'Status', content: 'APPROVED' },
      'Agent1', 'First edit'
    );

    await editWish(
      tmpDir, 'test-feature',
      { type: 'update_field', field: 'Status', content: 'IN_PROGRESS' },
      'Agent2', 'Second edit'
    );

    const changelog = await readChangelog(tmpDir, 'test-feature');

    // Each entry should have hashes
    expect(changelog[0].previousHash).toBeDefined();
    expect(changelog[0].newHash).toBeDefined();

    // The new hash of edit 1 should match the previous hash of edit 2
    // (since edit 2 reads the document after edit 1 wrote it)
    expect(changelog[1].previousHash).toBe(changelog[0].newHash);
  });
});
