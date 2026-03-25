import { describe, it, expect, beforeAll } from 'vitest';
import { CodeGraph } from '../../src/graph/code-graph.js';
import { ContextExtractor } from '../../src/query/context-extractor.js';
import { TypeScriptPlugin } from '../../src/plugins/typescript.js';
import * as path from 'node:path';

describe('Integration: Full Pipeline', () => {
  let graph: CodeGraph;
  let extractor: ContextExtractor;

  beforeAll(async () => {
    graph = new CodeGraph();
    await graph.build(path.resolve('fixtures/typescript'), [new TypeScriptPlugin()]);
    extractor = new ContextExtractor(graph);
  });

  it('builds graph with correct node count from fixtures', () => {
    const nodes = graph.getAllNodes();
    // greet, farewell, User, Identifiable, getDisplayName, greetUser, createUser, getUserName, processUser
    expect(nodes.length).toBeGreaterThanOrEqual(6);
  });

  it('extracts context for farewell with callees included', () => {
    const ctx = extractor.extract('farewell', { budget: 500, mode: 'debug' });
    expect(ctx.target.name).toBe('farewell');
    expect(ctx.tokenCount).toBeLessThanOrEqual(500);
    // debug mode: should include callee 'greet'
    const relatedNames = ctx.related.map(r => r.name);
    expect(relatedNames).toContain('greet');
  });

  it('extracts cross-file context for processUser', () => {
    const ctx = extractor.extract('processUser', { budget: 2000, mode: 'debug' });
    expect(ctx.target.name).toBe('processUser');
    // Should include cross-file dependencies
    expect(ctx.related.length).toBeGreaterThan(0);
  });

  it('impact analysis on greet finds transitive callers', () => {
    const result = extractor.impact('greet');
    expect(result.directCallers.length).toBeGreaterThanOrEqual(1); // at least farewell
    expect(result.affectedFiles.length).toBeGreaterThanOrEqual(1);
  });
});
