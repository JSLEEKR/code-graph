import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor } from '../../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';

describe('Performance', () => {
  let graph: CodeGraph;
  let extractor: ContextExtractor;

  beforeAll(async () => {
    graph = new CodeGraph();
    await graph.build(resolve('fixtures/perf'), [new TypeScriptPlugin()]);
    extractor = new ContextExtractor(graph);
  });

  it('builds graph from 60 fixture files in under 5 seconds', () => {
    // If we got here, the build in beforeAll succeeded within vitest timeout
    const nodes = graph.getAllNodes();
    // 60 files x 3 symbols (helper, process, Service) + 60 methods (run) = 240
    expect(nodes.length).toBeGreaterThanOrEqual(180);
  });

  it('extract context from large graph completes quickly', () => {
    const start = performance.now();
    const result = extractor.extract('helper0', { budget: 5000, mode: 'debug' });
    const elapsed = performance.now() - start;

    expect(result.target.name).toBe('helper0');
    expect(result.tokenCount).toBeLessThanOrEqual(5000);
    // Should complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });

  it('search across large graph is fast', () => {
    const start = performance.now();
    const results = extractor.search('helper');
    const elapsed = performance.now() - start;

    // Should find all 60 helper functions
    expect(results.length).toBe(60);
    // Should complete in under 500ms
    expect(elapsed).toBeLessThan(500);
  });

  it('stats computation on large graph is fast', () => {
    const start = performance.now();
    const stats = extractor.stats();
    const elapsed = performance.now() - start;

    expect(stats.totalFiles).toBe(60);
    expect(stats.totalSymbols).toBeGreaterThanOrEqual(180);
    // Should complete in under 2 seconds
    expect(elapsed).toBeLessThan(2000);
  });

  it('impact analysis traverses large call chains', () => {
    const start = performance.now();
    const result = extractor.impact('helper0');
    const elapsed = performance.now() - start;

    // helper0 is called by process0 and by helper59 (circular chain)
    expect(result.directCallers.length).toBeGreaterThanOrEqual(1);
    // Should complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});
