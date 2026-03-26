import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor } from '../../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import { PythonPlugin } from '../../src/plugins/python.js';
import { CacheManager } from '../../src/cache/cache-manager.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Integration: Full Pipeline Scenarios', () => {
  describe('TypeScript-only pipeline', () => {
    let graph: CodeGraph;
    let extractor: ContextExtractor;

    beforeAll(async () => {
      graph = new CodeGraph();
      await graph.build(resolve('fixtures/typescript'), [new TypeScriptPlugin()]);
      extractor = new ContextExtractor(graph);
    });

    it('build → context → impact → search → deps → stats full pipeline', () => {
      // 1. Build succeeded (via beforeAll)
      const nodes = graph.getAllNodes();
      expect(nodes.length).toBeGreaterThan(0);

      // 2. Context extraction
      const ctx = extractor.extract('farewell', { budget: 2000, mode: 'debug' });
      expect(ctx.target.name).toBe('farewell');
      expect(ctx.tokenCount).toBeLessThanOrEqual(2000);
      expect(ctx.related.length).toBeGreaterThan(0);

      // 3. Impact analysis
      const impact = extractor.impact('greet');
      expect(impact.riskLevel).toBeDefined();
      expect(impact.directCallers.length).toBeGreaterThan(0);

      // 4. Search
      const results = extractor.search('User');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBe(1.0); // exact match

      // 5. Dependencies
      const deps = extractor.dependencies('farewell', 'upstream');
      expect(deps.nodes.length).toBeGreaterThan(0);

      // 6. Stats
      const stats = extractor.stats();
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(stats.byLanguage).toHaveProperty('TypeScript');
    });
  });

  describe('Python-only pipeline', () => {
    let graph: CodeGraph;
    let extractor: ContextExtractor;

    beforeAll(async () => {
      graph = new CodeGraph();
      await graph.build(resolve('fixtures/python'), [new PythonPlugin()]);
      extractor = new ContextExtractor(graph);
    });

    it('build → context → search → stats for Python fixtures', () => {
      // 1. Build
      const nodes = graph.getAllNodes();
      expect(nodes.length).toBeGreaterThan(0);
      const names = nodes.map(n => n.symbol.name);
      expect(names).toContain('greet');

      // 2. Context
      const ctx = extractor.extract('farewell', { budget: 2000, mode: 'debug' });
      expect(ctx.target.name).toBe('farewell');
      expect(ctx.tokenCount).toBeGreaterThan(0);

      // 3. Search
      const results = extractor.search('compute');
      expect(results.length).toBeGreaterThan(0);

      // 4. Stats
      const stats = extractor.stats();
      expect(stats.byLanguage).toHaveProperty('Python');
      expect(stats.byLanguage['Python'].files).toBeGreaterThan(0);
    });
  });

  describe('Mixed TS + Python pipeline', () => {
    let graph: CodeGraph;
    let extractor: ContextExtractor;

    beforeAll(async () => {
      graph = new CodeGraph();
      await graph.build(resolve('fixtures'), [new TypeScriptPlugin(), new PythonPlugin()]);
      extractor = new ContextExtractor(graph);
    });

    it('handles both languages in single graph', () => {
      const stats = extractor.stats();
      expect(stats.byLanguage).toHaveProperty('TypeScript');
      expect(stats.byLanguage).toHaveProperty('Python');
      expect(stats.totalFiles).toBeGreaterThan(4);
    });
  });

  describe('cache → rebuild cycle', () => {
    it('build → save → load → query produces consistent results', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'integ-cache-'));
      try {
        // Write fixture files
        await fs.writeFile(
          path.join(tmpDir, 'app.ts'),
          `export function handleRequest(req: string) {\n  return validate(req);\n}\n\nexport function validate(input: string) {\n  return input.trim();\n}\n`,
        );

        // Build original graph
        const graph1 = new CodeGraph();
        await graph1.build(tmpDir, [new TypeScriptPlugin()]);
        const ext1 = new ContextExtractor(graph1);
        const ctx1 = ext1.extract('handleRequest', { budget: 2000, mode: 'debug' });

        // Save to cache
        const cacheDir = path.join(tmpDir, '.code-graph');
        const cache = new CacheManager(cacheDir);
        await cache.save(graph1, new Map());

        // Load from cache
        const loaded = await cache.load();
        expect(loaded).not.toBeNull();

        // Query from loaded graph
        const ext2 = new ContextExtractor(loaded!.graph);
        const ctx2 = ext2.extract('handleRequest', { budget: 2000, mode: 'debug' });

        // Results should match
        expect(ctx2.target.name).toBe(ctx1.target.name);
        expect(ctx2.related.length).toBe(ctx1.related.length);
        expect(ctx2.tokenCount).toBe(ctx1.tokenCount);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
});
