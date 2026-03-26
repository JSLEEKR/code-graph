import { describe, it, expect } from 'vitest';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor } from '../../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { CacheManager } from '../../src/cache/cache-manager.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Stress Tests', () => {
  it('handles 200-node graph: build + context extraction under 10s', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stress-200-'));
    try {
      // Generate 200 files, each with a function that calls the next
      for (let i = 0; i < 200; i++) {
        const callLine = i < 199
          ? `  return fn${i + 1}();`
          : `  return ${i};`;
        const importLine = i < 199
          ? `import { fn${i + 1} } from './file${i + 1}';\n`
          : '';
        const content = `${importLine}export function fn${i}(x: number) {\n${callLine}\n}\n`;
        await fs.writeFile(path.join(tmpDir, `file${i}.ts`), content);
      }

      // Build
      const buildStart = performance.now();
      const graph = new CodeGraph();
      await graph.build(tmpDir, [new TypeScriptPlugin()]);
      const buildElapsed = performance.now() - buildStart;

      const nodes = graph.getAllNodes();
      expect(nodes.length).toBe(200);
      expect(buildElapsed).toBeLessThan(10000); // Under 10s

      // Context extraction on 200-node graph
      const extractor = new ContextExtractor(graph);
      const extractStart = performance.now();
      const ctx = extractor.extract('fn0', { budget: 10000, mode: 'debug' });
      const extractElapsed = performance.now() - extractStart;

      expect(ctx.target.name).toBe('fn0');
      expect(ctx.tokenCount).toBeLessThanOrEqual(10000);
      expect(ctx.related.length).toBeGreaterThan(0);
      expect(extractElapsed).toBeLessThan(5000); // Under 5s

      // Search across 200 nodes
      const searchStart = performance.now();
      const results = extractor.search('fn');
      const searchElapsed = performance.now() - searchStart;

      expect(results.length).toBe(200);
      expect(searchElapsed).toBeLessThan(2000);

      // Stats
      const statsStart = performance.now();
      const stats = extractor.stats();
      const statsElapsed = performance.now() - statsStart;

      expect(stats.totalSymbols).toBe(200);
      expect(stats.totalFiles).toBe(200);
      expect(statsElapsed).toBeLessThan(5000);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30000); // 30s timeout

  it('cache rebuild cycle stress: save/load 5 times', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stress-cache-'));
    try {
      // Create a small graph
      for (let i = 0; i < 20; i++) {
        const content = `export function stressFn${i}() { return ${i}; }\n`;
        await fs.writeFile(path.join(tmpDir, `mod${i}.ts`), content);
      }

      const cacheDir = path.join(tmpDir, '.code-graph');

      for (let cycle = 0; cycle < 5; cycle++) {
        // Build
        const graph = new CodeGraph();
        await graph.build(tmpDir, [new TypeScriptPlugin()]);
        expect(graph.getAllNodes().length).toBe(20);

        // Save
        const cache = new CacheManager(cacheDir);
        await cache.save(graph, new Map());

        // Load
        const loaded = await cache.load();
        expect(loaded).not.toBeNull();
        expect(loaded!.graph.getAllNodes().length).toBe(20);

        // Query from loaded
        const extractor = new ContextExtractor(loaded!.graph);
        const ctx = extractor.extract('stressFn0', { budget: 5000, mode: 'debug' });
        expect(ctx.target.name).toBe('stressFn0');

        // Clear cache for next cycle
        await cache.clear();
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30000);

  it('impact analysis on deeply chained graph', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stress-impact-'));
    try {
      // Create a chain: fn0 -> fn1 -> fn2 -> ... -> fn49
      for (let i = 0; i < 50; i++) {
        const callLine = i < 49
          ? `  return chain${i + 1}();`
          : `  return "end";`;
        const importLine = i < 49
          ? `import { chain${i + 1} } from './chain${i + 1}';\n`
          : '';
        await fs.writeFile(
          path.join(tmpDir, `chain${i}.ts`),
          `${importLine}export function chain${i}() {\n${callLine}\n}\n`,
        );
      }

      const graph = new CodeGraph();
      await graph.build(tmpDir, [new TypeScriptPlugin()]);
      const extractor = new ContextExtractor(graph);

      const start = performance.now();
      const impact = extractor.impact('chain49');
      const elapsed = performance.now() - start;

      // chain49 is the end of the chain, called by chain48
      expect(impact.directCallers.length).toBeGreaterThanOrEqual(1);
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 15000);
});
