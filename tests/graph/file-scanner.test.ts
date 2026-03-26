import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { scanFiles } from '../../src/graph/file-scanner.js';

describe('File Scanner', () => {
  it('scans fixture directory for .ts files', async () => {
    const files = await scanFiles(resolve('fixtures/typescript'), ['.ts']);
    expect(files.length).toBeGreaterThanOrEqual(4);
    const basenames = files.map(f => f.split(/[/\\]/).pop());
    expect(basenames).toContain('simple.ts');
    expect(basenames).toContain('classes.ts');
    expect(basenames).toContain('imports-a.ts');
    expect(basenames).toContain('imports-b.ts');
  });

  it('filters by provided extensions only', async () => {
    const files = await scanFiles(resolve('fixtures'), ['.py']);
    // Should only contain .py files, no .ts
    for (const f of files) {
      expect(f).toMatch(/\.py$/);
    }
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array when no files match extensions', async () => {
    const files = await scanFiles(resolve('fixtures/typescript'), ['.rs']);
    expect(files).toEqual([]);
  });
});
