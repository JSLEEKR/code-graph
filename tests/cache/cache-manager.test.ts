import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { resolve } from 'path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CacheManager } from '../../src/cache/cache-manager.js';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';

describe('CacheManager', () => {
  let graph: CodeGraph;
  const fixtureDir = resolve('fixtures/typescript');
  let tempDirs: string[] = [];

  async function makeTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-manager-test-'));
    tempDirs.push(dir);
    return dir;
  }

  beforeAll(async () => {
    graph = new CodeGraph();
    await graph.build(fixtureDir, [new TypeScriptPlugin()]);
  });

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    tempDirs = [];
  });

  it('save and load roundtrip preserves graph', async () => {
    const cacheDir = await makeTempDir();
    const manager = new CacheManager(cacheDir);

    const fileMtimes = new Map<string, number>([
      [resolve(fixtureDir, 'simple.ts'), 1700000000000],
      [resolve(fixtureDir, 'classes.ts'), 1700000001000],
    ]);

    await manager.save(graph, fileMtimes);

    const loaded = await manager.load();
    expect(loaded).not.toBeNull();

    const { graph: restoredGraph, fileMtimes: restoredMtimes } = loaded!;

    // Graph nodes should be preserved
    const originalNodes = graph.getAllNodes();
    const restoredNodes = restoredGraph.getAllNodes();
    expect(restoredNodes.length).toBe(originalNodes.length);

    // Specific node should survive roundtrip
    const simplePath = resolve(fixtureDir, 'simple.ts');
    const node = restoredGraph.getNode(`${simplePath}::greet`);
    expect(node).toBeDefined();
    expect(node!.symbol.name).toBe('greet');

    // fileMtimes should be preserved
    expect(restoredMtimes.size).toBe(fileMtimes.size);
    expect(restoredMtimes.get(resolve(fixtureDir, 'simple.ts'))).toBe(1700000000000);
    expect(restoredMtimes.get(resolve(fixtureDir, 'classes.ts'))).toBe(1700000001000);
  });

  it('load returns null for missing cache', async () => {
    const cacheDir = await makeTempDir();
    const manager = new CacheManager(path.join(cacheDir, 'nonexistent-subdir'));

    const result = await manager.load();
    expect(result).toBeNull();
  });

  it('load returns null for corrupt cache file', async () => {
    const cacheDir = await makeTempDir();
    const manager = new CacheManager(cacheDir);

    // Write invalid JSON
    await fs.writeFile(path.join(cacheDir, 'cache.json'), 'not valid json {{{{', 'utf-8');

    const result = await manager.load();
    expect(result).toBeNull();
  });

  it('getChangedFiles detects modified files', async () => {
    const fileA = resolve(fixtureDir, 'simple.ts');
    const fileB = resolve(fixtureDir, 'classes.ts');
    const fileC = resolve(fixtureDir, 'imports-a.ts');
    const fileD = resolve(fixtureDir, 'imports-b.ts');

    const savedMtimes = new Map<string, number>([
      [fileA, 1000],
      [fileB, 2000],
      [fileC, 3000],
    ]);

    // fileA: same mtime => not changed
    // fileB: different mtime => changed
    // fileC: deleted (not in current) => changed
    // fileD: new file (not in saved) => changed
    const currentMtimes = new Map<string, number>([
      [fileA, 1000],
      [fileB, 9999],
      [fileD, 4000],
    ]);

    const cacheDir = await makeTempDir();
    const manager = new CacheManager(cacheDir);
    const changed = await manager.getChangedFiles(currentMtimes, savedMtimes);

    expect(changed).toContain(fileB);  // modified
    expect(changed).toContain(fileC);  // deleted
    expect(changed).toContain(fileD);  // new
    expect(changed).not.toContain(fileA);  // unchanged
  });

  it('clear removes cache directory', async () => {
    const cacheDir = await makeTempDir();
    const manager = new CacheManager(cacheDir);

    const fileMtimes = new Map<string, number>([
      [resolve(fixtureDir, 'simple.ts'), 1700000000000],
    ]);
    await manager.save(graph, fileMtimes);

    // Verify cache exists before clear
    const cacheFile = path.join(cacheDir, 'cache.json');
    await expect(fs.access(cacheFile)).resolves.toBeUndefined();

    await manager.clear();

    // Directory should no longer exist
    await expect(fs.access(cacheDir)).rejects.toThrow();
  });
});
