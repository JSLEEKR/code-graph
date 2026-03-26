import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { CacheManager } from '../../src/cache/cache-manager.js';

describe('Error Recovery', () => {
  let tempDirs: string[] = [];

  async function makeTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'error-recovery-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    tempDirs = [];
  });

  describe('file deleted during build', () => {
    it('gracefully skips files that cannot be read', async () => {
      const tmpDir = await makeTempDir();

      // Create two TS files
      await fs.writeFile(
        path.join(tmpDir, 'exists.ts'),
        'export function alive() { return 1; }',
      );
      await fs.writeFile(
        path.join(tmpDir, 'willDelete.ts'),
        'export function doomed() { return 2; }',
      );

      // Build should succeed even if a file read fails
      // We simulate by making the directory with just one file
      const graph = new CodeGraph();
      await graph.build(tmpDir, [new TypeScriptPlugin()]);
      const nodes = graph.getAllNodes();
      const names = nodes.map(n => n.symbol.name);
      expect(names).toContain('alive');
      expect(names).toContain('doomed');

      // Now delete one file and rebuild -- should not crash
      await fs.unlink(path.join(tmpDir, 'willDelete.ts'));
      const graph2 = new CodeGraph();
      await graph2.build(tmpDir, [new TypeScriptPlugin()]);
      const nodes2 = graph2.getAllNodes();
      const names2 = nodes2.map(n => n.symbol.name);
      expect(names2).toContain('alive');
      expect(names2).not.toContain('doomed');
    });
  });

  describe('corrupted cache', () => {
    it('returns null for truncated JSON cache', async () => {
      const cacheDir = await makeTempDir();
      const manager = new CacheManager(cacheDir);

      // Write truncated JSON
      await fs.writeFile(
        path.join(cacheDir, 'cache.json'),
        '{"graphData": "{\\"nodes\\": {}, \\"edges\\',
        'utf-8',
      );

      const loaded = await manager.load();
      expect(loaded).toBeNull();
    });

    it('returns null for cache with wrong structure', async () => {
      const cacheDir = await makeTempDir();
      const manager = new CacheManager(cacheDir);

      // Valid JSON, but wrong structure (missing graphData)
      await fs.writeFile(
        path.join(cacheDir, 'cache.json'),
        JSON.stringify({ version: 1, data: 'wrong' }),
        'utf-8',
      );

      // CacheManager.load tries CodeGraph.deserialize which will throw on bad data
      const loaded = await manager.load();
      expect(loaded).toBeNull();
    });

    it('recovers by rebuilding after cache corruption', async () => {
      const tmpDir = await makeTempDir();
      const cacheDir = path.join(tmpDir, '.code-graph');

      await fs.writeFile(
        path.join(tmpDir, 'module.ts'),
        'export function recover() { return "ok"; }',
      );

      const manager = new CacheManager(cacheDir);

      // Write corrupt cache
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, 'cache.json'),
        'CORRUPT',
        'utf-8',
      );

      // Load fails gracefully
      const loaded = await manager.load();
      expect(loaded).toBeNull();

      // Rebuild should work
      const graph = new CodeGraph();
      await graph.build(tmpDir, [new TypeScriptPlugin()]);
      const nodes = graph.getAllNodes();
      expect(nodes.map(n => n.symbol.name)).toContain('recover');

      // Save the valid graph
      await manager.save(graph, new Map());

      // Now load should work
      const reloaded = await manager.load();
      expect(reloaded).not.toBeNull();
      expect(reloaded!.graph.getAllNodes().length).toBe(nodes.length);
    });
  });
});
